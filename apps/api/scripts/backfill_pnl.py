"""
backfill_pnl.py — One-Time Backfill Script for realized_pnl Table

Usage:
    cd apps/api
    python -m scripts.backfill_pnl

What it does:
- Scans every Allotment row with status="SOLD" that has a sell_price set.
- For each one, checks if a RealizedPnl record already exists (idempotent).
- If not, calculates net_pnl and roi_percent and inserts the record.

Run this once after deploying the pnl_service for the first time to backfill
historical sell data that predates the automated recording.
"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("backfill_pnl")


async def run_backfill():
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    from app.db.database import AsyncSessionLocal
    from app.models.allotment import Allotment
    from app.services.pnl_service import pnl_service
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        stmt = select(Allotment).where(
            Allotment.status == "SOLD",
            Allotment.sell_price.isnot(None),
            Allotment.sell_price > 0,
        )
        res = await db.execute(stmt)
        sold_allotments = res.scalars().all()

        logger.info(f"Found {len(sold_allotments)} sold allotments to backfill.")
        created = 0
        skipped = 0

        for allotment in sold_allotments:
            exit_px = float(allotment.sell_price or 0.0)
            if exit_px <= 0:
                skipped += 1
                continue

            record = await pnl_service.record_sell(
                db=db,
                allotment=allotment,
                exit_price=exit_px,
                exit_type="PRE_MARKET_LISTING",
            )
            if record:
                created += 1
                logger.info(
                    f"[Backfill] Created PnL record: {allotment.ipo_symbol} "
                    f"— {allotment.allotted_shares} shares @ ₹{exit_px}"
                )
            else:
                skipped += 1
                logger.info(f"[Backfill] Skipped {allotment.ipo_symbol} (already exists)")

        await db.commit()
        logger.info(f"Backfill complete: {created} created, {skipped} skipped.")


if __name__ == "__main__":
    asyncio.run(run_backfill())
