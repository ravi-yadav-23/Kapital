from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock
from app.schemas.fund import FundSummaryResponse


class FundService:
    """
    Corpus Aggregation, ASBA Liquidity Timeline & Utilization Analytics.
    """

    @staticmethod
    async def get_fund_summary(db: AsyncSession) -> FundSummaryResponse:
        """Calculate total family corpus balance, available liquid deployment cash, and ASBA locked totals."""
        stmt = select(FamilyAccount)
        res = await db.execute(stmt)
        accounts = res.scalars().all()

        total_family = sum(a.total_demat_balance or 0.0 for a in accounts)
        total_available = sum(a.available_liquid_balance or 0.0 for a in accounts)
        total_locked = sum(a.locked_asba_balance or 0.0 for a in accounts)
        utilization = (total_locked / total_family * 100.0) if total_family > 0 else 0.0
        active_count = sum(1 for a in accounts if a.is_active)

        return FundSummaryResponse(
            total_family_balance=total_family,
            total_available=total_available,
            total_locked_asba=total_locked,
            utilization_percent=round(utilization, 1),
            accounts_active=active_count,
            accounts_total=len(accounts),
        )

    @staticmethod
    async def check_asba_lock_conflicts(db: AsyncSession) -> List[Dict[str, Any]]:
        """Identify ASBA locks that conflict with open IPO bidding windows."""
        stmt = select(AsbaLock).where(AsbaLock.release_date >= AsbaLock.lock_date)
        res = await db.execute(stmt)
        locks = res.scalars().all()

        conflicts = []
        for lock in locks:
            if lock.is_conflict:
                conflicts.append({
                    "lock_id": lock.id,
                    "account_name": lock.account_name,
                    "ipo_name": lock.ipo_name,
                    "amount": lock.amount,
                    "release_date": str(lock.release_date),
                    "conflict_details": lock.next_ipo_conflict,
                })
        return conflicts


fund_service = FundService()
