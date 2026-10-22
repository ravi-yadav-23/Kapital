import logging
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ipo import Ipo
from app.models.report import AiReport
from app.agents.orchestrator import orchestrator

logger = logging.getLogger("tasks.report")


async def generate_nightly_ipo_dossiers(db: AsyncSession, max_batch: int = 5) -> int:
    """
    Scheduled nightly job executed at 22:00:00 IST.
    Iterates through all open and upcoming IPO issues without an existing report,
    and invokes the multi-agent orchestrator with rate-limiting pauses between calls.
    """
    stmt = select(Ipo).where(Ipo.status.in_(["open", "closing_today", "upcoming"])).order_by(Ipo.created_at.desc())
    res = await db.execute(stmt)
    ipos = res.scalars().all()

    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    generated_count = 0

    for ipo in ipos:
        if generated_count >= max_batch:
            logger.info(f"Reached nightly AI report batch limit ({max_batch}). Ending run to protect LLM quota.")
            break

        # Check if recent report already exists
        report_stmt = select(AiReport).where(
            AiReport.ipo_id == ipo.id,
            AiReport.created_at >= cutoff_24h,
        )
        report_res = await db.execute(report_stmt)
        existing_report = report_res.scalar_one_or_none()

        if existing_report:
            logger.debug(f"Fresh report for {ipo.symbol} already generated within 24h. Skipping.")
            continue

        try:
            logger.info(f"Generating scheduled multi-agent dossier for {ipo.symbol}...")
            await orchestrator.run_full_due_diligence(db, ipo.id)
            generated_count += 1
            # Throttling delay between LLM calls to respect Groq/Gemini RPM quotas
            await asyncio.sleep(2.5)
        except Exception as e:
            logger.error(f"Error generating nightly report for {ipo.symbol}: {e}")

    logger.info(f"Nightly IPO due diligence run complete. Generated {generated_count} new dossiers.")
    return generated_count


async def generate_nightly_reports(max_batch: int = 5) -> int:
    """
    Self-managed session wrapper for Celery and external workers.
    Runs generate_nightly_ipo_dossiers inside its own database session.
    """
    from app.db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await generate_nightly_ipo_dossiers(db, max_batch=max_batch)

