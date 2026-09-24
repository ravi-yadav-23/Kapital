from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date

from app.models.allotment import Allotment, AsbaLock
from app.schemas.allotment import AllotmentResponse, StageSellRequest, AsbaLockResponse
from app.services.angel_service import angel_service

MOCK_ALLOTMENTS_STORE: List[Dict[str, Any]] = []
MOCK_ASBA_LOCKS: List[Dict[str, Any]] = []


def _format_date(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _model_to_allotment_response(a: Allotment) -> AllotmentResponse:
    return AllotmentResponse(
        id=a.id,
        account_id=a.account_id,
        ipo_id=a.ipo_id,
        account_name=a.account_name,
        angel_client_id=getattr(a, "angel_client_id", None),
        ipo_name=a.ipo_name,
        ipo_symbol=a.ipo_symbol,
        allotted_shares=a.allotted_shares,
        issue_price=a.issue_price,
        invested_amount=a.invested_amount,
        status=a.status or "ACTIVE",
        current_price=a.current_price,
        listing_date=_format_date(a.listing_date),
        staged_sell_limit_price=a.staged_sell_limit_price,
        sell_order_id=a.sell_order_id,
        sell_price=a.sell_price,
        sell_date=_format_date(a.sell_date),
        realized_pnl=a.realized_pnl,
        roi_percent=a.roi_percent,
    )


def _model_to_lock_response(lock: AsbaLock) -> AsbaLockResponse:
    return AsbaLockResponse(
        id=lock.id,
        account_id=lock.account_id,
        ipo_id=lock.ipo_id,
        account_name=lock.account_name,
        ipo_name=lock.ipo_name,
        amount=lock.amount,
        lock_date=_format_date(lock.lock_date) or "",
        release_date=_format_date(lock.release_date) or "",
        next_ipo_conflict=lock.next_ipo_conflict,
        is_conflict=bool(lock.is_conflict),
    )


class AllotmentService:

    @staticmethod
    async def get_allotments(db: AsyncSession, status: Optional[str] = None) -> List[AllotmentResponse]:
        stmt = select(Allotment)
        if status and status != "ALL":
            stmt = stmt.where(Allotment.status == status)
        stmt = stmt.order_by(Allotment.created_at.desc())

        res = await db.execute(stmt)
        allotments = res.scalars().all()
        return [_model_to_allotment_response(a) for a in allotments]

    @staticmethod
    async def get_asba_locks(db: AsyncSession) -> List[AsbaLockResponse]:
        stmt = select(AsbaLock).order_by(AsbaLock.release_date.asc())
        res = await db.execute(stmt)
        locks = res.scalars().all()
        return [_model_to_lock_response(l) for l in locks]

    @staticmethod
    async def stage_sell_order(db: AsyncSession, allotment_id: str, data: StageSellRequest) -> Dict[str, Any]:
        from app.models.account import FamilyAccount

        stmt = select(Allotment).where(Allotment.id == allotment_id)
        res = await db.execute(stmt)
        alt = res.scalar_one_or_none()
        if not alt:
            return {"success": False, "message": "Allotment not found"}

        alt.staged_sell_limit_price = data.limit_price
        alt.status = "ACTIVE"

        # Resolve real Angel One client_id code (e.g., R1234567)
        client_code = alt.angel_client_id
        if not client_code:
            acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == alt.account_id))
            acc = acc_res.scalar_one_or_none()
            if acc and acc.angel_client_id:
                client_code = acc.angel_client_id
                alt.angel_client_id = client_code

        # Trigger order staging via SmartAPI using real client_id code
        api_res = await angel_service.stage_listing_sell_order(
            client_id=client_code or alt.account_name,
            symbol=alt.ipo_symbol,
            shares=alt.allotted_shares,
            limit_price=data.limit_price,
        )
        alt.sell_order_id = api_res.get("sell_order_id")
        await db.flush()
        await db.refresh(alt)

        return {
            "success": True,
            "message": f"Pre-listing sell staged at ₹{data.limit_price} for {alt.ipo_symbol} (09:00:00 AM IST)",
            "allotment": _model_to_allotment_response(alt),
        }

    @staticmethod
    async def auto_detect_allotments(db: AsyncSession) -> Dict[str, Any]:
        """
        Scans all pending/confirmed IPO orders against broker demat holdings.
        If shares are credited in demat, marks order as ALLOTTED and stages holdings for listing day.
        If listing date has passed by > 1 day and no shares credited, automatically marks NOT_ALLOTTED and releases ASBA locked funds.
        """
        from app.models.order import Order
        from app.models.ipo import Ipo
        from app.models.account import FamilyAccount
        from app.services.order_service import order_service
        from datetime import date, timedelta

        today = date.today()
        stmt = select(Order).where(Order.status.in_(["SUBMITTED", "CONFIRMED", "APPLIED"]))
        res = await db.execute(stmt)
        orders = res.scalars().all()

        results = {"allotted": 0, "not_allotted": 0, "pending": 0, "details": []}
        holdings_by_client: Dict[str, List[Dict[str, Any]]] = {}

        for ord in orders:
            ipo_res = await db.execute(select(Ipo).where(Ipo.id == ord.ipo_id))
            ipo = ipo_res.scalar_one_or_none()
            if not ipo:
                continue

            allot_date = ipo.allotment_date
            listing_date = ipo.listing_date

            if allot_date and today < allot_date:
                results["pending"] += 1
                continue

            client_id = ""
            acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == ord.account_id))
            acc = acc_res.scalar_one_or_none()
            if acc and acc.angel_client_id:
                client_id = acc.angel_client_id

            if not client_id:
                continue

            if client_id not in holdings_by_client:
                holdings_by_client[client_id] = await angel_service.get_all_holdings(client_id)

            holdings = holdings_by_client[client_id]
            clean_sym = (ipo.symbol or "").upper().replace("-EQ", "").strip()

            matched_holding = next(
                (h for h in holdings if clean_sym in (h.get("tradingsymbol") or "").upper() or clean_sym in (h.get("symbolname") or "").upper()),
                None
            )

            if matched_holding and int(matched_holding.get("totalqty", 0)) > 0:
                await order_service.process_allotment_result(db, ord.id, result="ALLOTTED")
                results["allotted"] += 1
                results["details"].append(f"[{ord.account_name}] Allotted {matched_holding.get('totalqty')} shares of {ipo.name}")
            elif listing_date and today > (listing_date + timedelta(days=1)):
                await order_service.process_allotment_result(db, ord.id, result="NOT_ALLOTTED")
                results["not_allotted"] += 1
                results["details"].append(f"[{ord.account_name}] Not allotted for {ipo.name} (Funds released)")
            else:
                results["pending"] += 1

        await db.commit()
        return results


allotment_service = AllotmentService()
