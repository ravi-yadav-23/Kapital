from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, date, timedelta
import uuid

from app.models.order import IpoOrder
from app.models.account import FamilyAccount
from app.models.ipo import Ipo
from app.models.allotment import AsbaLock, Allotment
from app.schemas.order import OrderCreate, OrderResponse
from app.services.angel_service import angel_service
from app.routers.websocket import broadcast_event


def _model_to_response(o: IpoOrder) -> OrderResponse:
    return OrderResponse(
        id=o.id,
        account_id=o.account_id,
        ipo_id=o.ipo_id,
        account_name=o.account_name,
        ipo_name=o.ipo_name,
        category=o.category or "RETAIL",
        lots=o.lots,
        shares=o.shares,
        bid_price=o.bid_price,
        amount=o.amount,
        upi_vpa=o.upi_vpa,
        angel_order_id=o.angel_order_id,
        status=o.status or "CONFIRMED",
        reject_reason=o.reject_reason,
        placed_at=o.placed_at.isoformat() if o.placed_at else datetime.now(timezone.utc).isoformat(),
    )


class OrderService:

    @staticmethod
    async def get_orders(
        db: AsyncSession,
        status: Optional[str] = None,
        account_name: Optional[str] = None,
        ipo_name: Optional[str] = None,
    ) -> List[OrderResponse]:
        stmt = select(IpoOrder).order_by(IpoOrder.placed_at.desc())

        if status and status != "ALL":
            stmt = stmt.where(IpoOrder.status == status)
        if account_name and account_name != "ALL":
            stmt = stmt.where(IpoOrder.account_name == account_name)
        if ipo_name and ipo_name != "ALL":
            stmt = stmt.where(IpoOrder.ipo_name == ipo_name)

        res = await db.execute(stmt)
        orders = res.scalars().all()
        return [_model_to_response(o) for o in orders]

    @staticmethod
    async def create_order(db: AsyncSession, data: OrderCreate) -> OrderResponse:
        # Fetch account from DB
        acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == data.account_id))
        acc = acc_res.scalar_one_or_none()
        if not acc:
            raise ValueError(f"Demat account with ID '{data.account_id}' not found.")

        # Fetch IPO from DB
        ipo_res = await db.execute(select(Ipo).where(Ipo.id == data.ipo_id))
        ipo = ipo_res.scalar_one_or_none()

        if not ipo:
            raise ValueError("IPO issue not found in database.")

        if ipo.status not in ["open", "closing_today"]:
            raise ValueError(
                f"Cannot place bid: '{ipo.name}' is currently {ipo.status.upper()}. "
                f"Stock exchanges (NSE/BSE) only accept ASBA retail bids during open bidding hours "
                f"between {ipo.issue_open_date} and {ipo.issue_close_date}."
            )

        lot_sz = ipo.lot_size or 1
        shares = data.lots * lot_sz
        amount = shares * data.bid_price

        # Check duplicate active applications under same account/PAN
        dup_stmt = select(IpoOrder).where(
            (IpoOrder.account_id == data.account_id)
            & (IpoOrder.ipo_id == data.ipo_id)
            & (IpoOrder.status.in_(["PENDING", "SUBMITTED", "CONFIRMED", "APPLIED", "ALLOTTED"]))
        )
        dup_res = await db.execute(dup_stmt)
        existing_bid = dup_res.scalar_one_or_none()
        if existing_bid:
            raise ValueError(
                f"An active application already exists for '{acc.name}' in '{ipo.name}' (Status: {existing_bid.status}). "
                "SEBI rules prohibit multiple applications under the same PAN."
            )

        # Validate sufficient liquid balance
        avail = acc.available_liquid_balance or 0.0
        if avail < amount:
            raise ValueError(
                f"Insufficient liquid balance in account '{acc.name}'. "
                f"Available: ₹{avail:,.2f}, Required for {data.lots} lot(s): ₹{amount:,.2f}."
            )

        acc_name = acc.name
        ipo_name = ipo.name

        # Record manual IPO application intent & reserve ASBA capital
        order_obj = IpoOrder(
            id=f"ord-{str(uuid.uuid4())[:8]}",
            account_id=data.account_id,
            ipo_id=data.ipo_id,
            account_name=acc_name,
            ipo_name=ipo_name,
            category=data.category,
            lots=data.lots,
            shares=shares,
            bid_price=data.bid_price,
            amount=amount,
            upi_vpa=data.upi_vpa,
            angel_order_id=None,
            status="PENDING",
            reject_reason=None,
            mandate_status="PENDING_SUBMISSION",
            placed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db.add(order_obj)

        acc.total_bids_placed = (acc.total_bids_placed or 0) + 1
        # Lock the ASBA balance
        acc.locked_asba_balance = (acc.locked_asba_balance or 0.0) + amount
        acc.available_liquid_balance = max(0.0, avail - amount)

        # Create persistent ASBA lock record for timeline tracking
        rel_dt = None
        if ipo and ipo.listing_date:
            try:
                rel_dt = datetime.strptime(str(ipo.listing_date)[:10], "%Y-%m-%d").date()
            except Exception:
                pass
        if not rel_dt:
            rel_dt = date.today() + timedelta(days=4)

        lock_obj = AsbaLock(
            id=f"lock-{str(uuid.uuid4())[:8]}",
            account_id=data.account_id,
            ipo_id=data.ipo_id,
            account_name=acc_name,
            ipo_name=ipo_name,
            amount=amount,
            lock_date=date.today(),
            release_date=rel_dt,
            is_conflict=False,
        )
        db.add(lock_obj)

        await db.commit()
        await db.refresh(order_obj)

        from app.services.account_service import _invalidate_accounts_cache
        _invalidate_accounts_cache()

        try:
            await broadcast_event("ORDER_PLACED", {
                "order_id": order_obj.id,
                "account_name": acc_name,
                "ipo_name": ipo_name,
                "amount": amount,
                "status": order_obj.status,
            })
        except Exception:
            pass

        return _model_to_response(order_obj)

    @staticmethod
    async def mark_applied(db: AsyncSession, order_id: str) -> OrderResponse:
        """Marks an order intent as applied manually in broker app."""
        stmt = select(IpoOrder).where(IpoOrder.id == order_id)
        res = await db.execute(stmt)
        order_obj = res.scalar_one_or_none()
        if not order_obj:
            raise ValueError("Order not found")

        order_obj.status = "APPLIED"
        order_obj.mandate_status = "SUBMITTED"
        await db.commit()

        try:
            await broadcast_event("ORDER_UPDATED", {
                "order_id": order_id,
                "status": "APPLIED",
                "account_name": order_obj.account_name,
                "ipo_name": order_obj.ipo_name,
            })
        except Exception:
            pass

        return _model_to_response(order_obj)

    @staticmethod
    async def cancel_order(db: AsyncSession, order_id: str) -> OrderResponse:
        """Cancels a staged application and releases the ASBA fund lock."""
        stmt = select(IpoOrder).where(IpoOrder.id == order_id)
        res = await db.execute(stmt)
        order_obj = res.scalar_one_or_none()
        if not order_obj:
            raise ValueError("Order not found")

        if order_obj.status == "CANCELLED":
            return _model_to_response(order_obj)

        # Release ASBA lock on account
        acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == order_obj.account_id))
        acc = acc_res.scalar_one_or_none()
        if acc and order_obj.status in ["CONFIRMED", "PENDING", "SUBMITTED"]:
            acc.locked_asba_balance = max(0.0, (acc.locked_asba_balance or 0.0) - order_obj.amount)
            acc.available_liquid_balance = (acc.available_liquid_balance or 0.0) + order_obj.amount

        # Remove corresponding ASBA lock record
        stmt_lock = select(AsbaLock).where(
            (AsbaLock.account_id == order_obj.account_id) & (AsbaLock.ipo_id == order_obj.ipo_id)
        )
        res_lock = await db.execute(stmt_lock)
        existing_lock = res_lock.scalar_one_or_none()
        if existing_lock:
            await db.delete(existing_lock)

        order_obj.status = "CANCELLED"
        order_obj.reject_reason = "Cancelled by user"
        order_obj.mandate_status = "REVOKED"
        await db.commit()

        from app.services.account_service import _invalidate_accounts_cache
        _invalidate_accounts_cache()

        try:
            await broadcast_event("ORDER_CANCELLED", {
                "order_id": order_id,
                "status": "CANCELLED",
                "account_name": order_obj.account_name,
                "ipo_name": order_obj.ipo_name,
            })
        except Exception:
            pass

        return _model_to_response(order_obj)

    @staticmethod
    async def delete_order(db: AsyncSession, order_id: str) -> Dict[str, Any]:
        """Deletes an order record and releases any associated ASBA locks."""
        stmt = select(IpoOrder).where(IpoOrder.id == order_id)
        res = await db.execute(stmt)
        order_obj = res.scalar_one_or_none()
        if not order_obj:
            raise ValueError("Order not found")

        # Release ASBA lock on account if active
        if order_obj.status in ["CONFIRMED", "PENDING", "SUBMITTED"]:
            acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == order_obj.account_id))
            acc = acc_res.scalar_one_or_none()
            if acc:
                acc.locked_asba_balance = max(0.0, (acc.locked_asba_balance or 0.0) - order_obj.amount)
                acc.available_liquid_balance = (acc.available_liquid_balance or 0.0) + order_obj.amount

        # Remove corresponding ASBA lock record
        stmt_lock = select(AsbaLock).where(
            (AsbaLock.account_id == order_obj.account_id) & (AsbaLock.ipo_id == order_obj.ipo_id)
        )
        res_lock = await db.execute(stmt_lock)
        existing_lock = res_lock.scalar_one_or_none()
        if existing_lock:
            await db.delete(existing_lock)

        await db.delete(order_obj)
        await db.commit()

        from app.services.account_service import _invalidate_accounts_cache
        _invalidate_accounts_cache()

        return {"success": True, "deleted_order_id": order_id}

    @staticmethod
    async def process_allotment_result(db: AsyncSession, order_id: str, result: str) -> Dict[str, Any]:
        """
        Processes allotment outcome:
        - NOT_ALLOTTED: Releases ASBA locked funds back to liquid balance and clears lock record.
        - ALLOTTED: Confirms demat allotment, clears lock record, and stages Allotment for 09:00 AM listing sell.
        """
        stmt = select(IpoOrder).where(IpoOrder.id == order_id)
        res = await db.execute(stmt)
        order_obj = res.scalar_one_or_none()
        if not order_obj:
            raise ValueError("Order not found")

        acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == order_obj.account_id))
        acc = acc_res.scalar_one_or_none()

        ipo_res = await db.execute(select(Ipo).where(Ipo.id == order_obj.ipo_id))
        ipo = ipo_res.scalar_one_or_none()

        # Remove ASBA lock record as funds are either debited or unblocked
        stmt_lock = select(AsbaLock).where(
            (AsbaLock.account_id == order_obj.account_id) & (AsbaLock.ipo_id == order_obj.ipo_id)
        )
        res_lock = await db.execute(stmt_lock)
        existing_lock = res_lock.scalar_one_or_none()
        if existing_lock:
            await db.delete(existing_lock)

        if result.upper() == "NOT_ALLOTTED":
            if acc and order_obj.status in ["CONFIRMED", "PENDING", "SUBMITTED"]:
                acc.locked_asba_balance = max(0.0, (acc.locked_asba_balance or 0.0) - order_obj.amount)
                acc.available_liquid_balance = (acc.available_liquid_balance or 0.0) + order_obj.amount

            order_obj.status = "NOT_ALLOTTED"
            order_obj.mandate_status = "UNBLOCKED"
            await db.commit()
            from app.services.account_service import _invalidate_accounts_cache
            _invalidate_accounts_cache()
            return {"success": True, "status": "NOT_ALLOTTED", "message": "ASBA lock released back to liquid balance."}

        elif result.upper() == "ALLOTTED":
            order_obj.status = "ALLOTTED"
            order_obj.mandate_status = "DEBITED"

            listing_dt = None
            if ipo and ipo.listing_date:
                try:
                    listing_dt = datetime.strptime(str(ipo.listing_date)[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            alt = Allotment(
                id=f"alt-{str(uuid.uuid4())[:8]}",
                account_id=order_obj.account_id,
                ipo_id=order_obj.ipo_id,
                account_name=order_obj.account_name,
                angel_client_id=acc.angel_client_id if acc else None,
                ipo_name=order_obj.ipo_name,
                ipo_symbol=ipo.symbol if ipo else "IPO",
                allotted_shares=order_obj.shares,
                issue_price=order_obj.bid_price,
                invested_amount=order_obj.amount,
                status="ACTIVE",
                current_price=order_obj.bid_price,
                listing_date=listing_dt,
            )
            db.add(alt)

            if acc:
                acc.total_allotments_won = (acc.total_allotments_won or 0) + 1
                acc.locked_asba_balance = max(0.0, (acc.locked_asba_balance or 0.0) - order_obj.amount)

            await db.commit()
            from app.services.account_service import _invalidate_accounts_cache
            _invalidate_accounts_cache()
            try:
                await broadcast_event("ALLOTMENT_RESULT", {
                    "order_id": order_id,
                    "status": "ALLOTTED",
                    "allotment_id": alt.id,
                    "ipo_name": order_obj.ipo_name,
                })
            except Exception:
                pass
            return {"success": True, "status": "ALLOTTED", "allotment_id": alt.id, "message": "Allotment confirmed and staged for listing-day sell."}

        else:
            raise ValueError("Invalid allotment result. Must be 'ALLOTTED' or 'NOT_ALLOTTED'.")


order_service = OrderService()
