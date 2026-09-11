import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.allotment import Allotment
from app.services.allotment_service import allotment_service
from app.schemas.allotment import StageSellRequest

logger = logging.getLogger("tasks.allotment")


async def run_listing_day_sell_staging(db: AsyncSession) -> int:
    """
    Scheduled job executed at 09:00:00 AM IST on market trading days.
    Scans for active allotments scheduled for listing today with configured limit sell orders,
    and dispatches limit sell orders to Angel One SmartAPI.
    """
    today = date.today()
    stmt = select(Allotment).where(
        (Allotment.listing_date == today)
        & (Allotment.status == "ACTIVE")
        & (Allotment.staged_sell_limit_price.isnot(None))
        & (Allotment.sell_order_id.is_(None))
    )
    res = await db.execute(stmt)
    allotments_to_sell = res.scalars().all()

    staged_count = 0
    for alt in allotments_to_sell:
        try:
            req = StageSellRequest(
                limit_price=alt.staged_sell_limit_price,
                trigger_time="09:00:00",
            )
            result = await allotment_service.stage_sell_order(db, alt.id, req)
            if result.get("success"):
                staged_count += 1
                logger.info(f"Successfully staged listing sell for {alt.ipo_symbol} in account {alt.account_name}")
        except Exception as e:
            logger.error(f"Failed to stage listing sell for allotment {alt.id}: {e}")

    await db.commit()
    logger.info(f"Listing sell staging complete. Dispatched {staged_count} pre-market orders.")
    return staged_count
