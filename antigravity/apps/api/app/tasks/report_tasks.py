import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ipo import Ipo
from app.agents.orchestrator import orchestrator

logger = logging.getLogger("tasks.report")


async def generate_nightly_ipo_dossiers(db: AsyncSession) -> int:
    """
    Scheduled nightly job executed at 22:00:00 IST.
    Iterates through all open and upcoming IPO issues without an existing report,
    and invokes the multi-agent orchestrator to generate full audit dossiers.
    """
    stmt = select(Ipo).where(Ipo.status.in_(["open", "closing_today", "upcoming"]))
    res = await db.execute(stmt)
    ipos = res.scalars().all()

    generated_count = 0
    for ipo in ipos:
        try:
            logger.info(f"Generating scheduled multi-agent dossier for {ipo.symbol}...")
            await orchestrator.run_full_due_diligence(db, ipo.id)
            generated_count += 1
        except Exception as e:
            logger.error(f"Error generating nightly report for {ipo.symbol}: {e}")

    logger.info(f"Nightly IPO due diligence run complete. Processed {generated_count} issues.")
    return generated_count
