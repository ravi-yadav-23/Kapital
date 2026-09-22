import logging
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.allotment import AsbaLock
from app.models.order import IpoOrder
from app.models.account import FamilyAccount

logger = logging.getLogger("tasks.order")


async def sync_expired_asba_locks(db: AsyncSession) -> int:
    """
    Scans for ASBA locks past their release date where no allotment occurred,
    and automatically releases the funds back to liquid balances.
    """
    today = date.today()
    stmt = select(AsbaLock).where(AsbaLock.release_date < today)
    res = await db.execute(stmt)
    expired_locks = res.scalars().all()

    released_count = 0
    for lock in expired_locks:
        try:
            # Check if order is still active
            acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == lock.account_id))
            acc = acc_res.scalar_one_or_none()
            if acc:
                acc.locked_asba_balance = max(0.0, (acc.locked_asba_balance or 0.0) - lock.amount)
                acc.available_liquid_balance = (acc.available_liquid_balance or 0.0) + lock.amount

            await db.delete(lock)
            released_count += 1
            logger.info(f"Released expired ASBA lock of ₹{lock.amount} for {lock.account_name} ({lock.ipo_name})")
        except Exception as e:
            logger.error(f"Failed to release expired lock {lock.id}: {e}")

    await db.commit()
    logger.info(f"Expired ASBA lock sweep complete. Released {released_count} locks.")
    return released_count
