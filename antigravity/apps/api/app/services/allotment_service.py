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
        is_conflict=str(lock.is_conflict).lower() in ["true", "1", "yes"],
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
        stmt = select(Allotment).where(Allotment.id == allotment_id)
        res = await db.execute(stmt)
        alt = res.scalar_one_or_none()
        if not alt:
            return {"success": False, "message": "Allotment not found"}

        alt.staged_sell_limit_price = data.limit_price
        alt.status = "ACTIVE"

        # Trigger order staging via SmartAPI
        api_res = await angel_service.stage_listing_sell_order(
            client_id=alt.account_name,
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


allotment_service = AllotmentService()
