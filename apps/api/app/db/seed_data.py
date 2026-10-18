import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.ipo import Ipo

logger = logging.getLogger("seed_data")

async def seed_initial_ipos_and_reports(db: AsyncSession) -> int:
    """
    Dynamically populates current Indian IPOs and generates one-time AI Due Diligence
    reports directly from live exchange feeds (ipoalerts.in & ipowatch.in).
    NO HARDCODED IPOS: All issues, price bands, GMP, and dates are dynamically fetched.
    """
    try:
        # Check if database already has IPOs
        count_stmt = select(func.count(Ipo.id))
        res = await db.execute(count_stmt)
        existing_count = res.scalar() or 0

        # Always trigger live pipeline if empty or periodically to ensure freshness
        from app.tasks.ipo_tasks import sync_ipos_pipeline
        logger.info("[Sync] Triggering dynamic market sync from live feeds...")
        synced = await sync_ipos_pipeline(db)
        logger.info(f"[Sync] Dynamic sync completed. Synced {synced} live IPOs from exchange.")
        return synced
    except Exception as e:
        logger.error(f"[Sync Error] Dynamic IPO sync failed: {e}")
        return 0
