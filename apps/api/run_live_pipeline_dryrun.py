import asyncio
import json
import logging
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("live_dryrun")

sys.path.insert(0, os.path.abspath("apps/api"))

from app.config import settings
from app.db.database import AsyncSessionLocal, init_db
from app.main import _seed_accounts_from_env
from app.tasks.ipo_tasks import sync_ipos_pipeline
from app.services.account_service import account_service
from app.services.ipo_service import ipo_service
from app.services.optimizer_service import AllocationOptimizer
from app.models.ipo import Ipo
from app.models.account import FamilyAccount
from app.models.report import AiReport
from sqlalchemy import select

async def run_dryrun():
    logger.info("=== STEP 3: LIVE MARKET PIPELINE DRY RUN ===")
    
    # 1. Initialize DB tables
    logger.info("[1/5] Initializing database...")
    await init_db()
    
    # 2. Seed Accounts from ANGEL_ACCOUNTS_JSON and sync live RMS balances
    logger.info("[2/5] Seeding Angel One accounts and syncing live RMS balances...")
    await _seed_accounts_from_env()
    
    async with AsyncSessionLocal() as db:
        # Check seeded accounts
        accs_res = await db.execute(select(FamilyAccount))
        db_accounts = accs_res.scalars().all()
        logger.info(f"Loaded {len(db_accounts)} family account(s) in DB:")
        for acc in db_accounts:
            logger.info(f" -> {acc.name} ({acc.angel_client_id}) | Liquid: ₹{acc.available_liquid_balance:,.2f} | Locked ASBA: ₹{acc.locked_asba_balance:,.2f}")

        # 3. Ingest Live IPO Market Pipeline
        logger.info("\n[3/5] Syncing live IPO market pipeline from ipoalerts + ipowatch...")
        synced_count = await sync_ipos_pipeline(db)
        logger.info(f"Pipeline sync finished: {synced_count} IPO records processed.")
        
        # Query active IPOs
        ipos_res = await db.execute(
            select(Ipo).where(Ipo.status.in_(["open", "closing_today", "upcoming"]))
        )
        active_ipos = ipos_res.scalars().all()
        logger.info(f"\nDiscovered {len(active_ipos)} active market issue(s):")
        for ipo in active_ipos[:6]:
            logger.info(
                f" -> {ipo.name} ({ipo.symbol}) | Type: {ipo.type} | Status: {ipo.status} | "
                f"Dates: {ipo.issue_open_date} to {ipo.issue_close_date} | GMP: +{ipo.gmp_percent}% | Score: {ipo.score}"
            )
            
        # 4. AI Due Diligence Report Verification
        logger.info("\n[4/5] Checking AI Due Diligence Dossiers...")
        rep_res = await db.execute(select(AiReport))
        reports = rep_res.scalars().all()
        logger.info(f"Total AI reports in DB: {len(reports)}")
        if reports:
            sample_rep = reports[0]
            logger.info(f"Sample Report for IPO ID {sample_rep.ipo_id}:")
            logger.info(f" -> Overall Score: {sample_rep.overall_score}/100 | Recommendation: {sample_rep.recommendation}")
            logger.info(f" -> Executive Summary: {sample_rep.executive_summary[:120]}...")
            logger.info(f" -> Key Strengths: {sample_rep.strengths[:2]}")
            logger.info(f" -> Key Risks: {sample_rep.risks[:2]}")
        
        # 5. Run PuLP Optimization on Live Market Data
        logger.info("\n[5/5] Running PuLP MILP Optimizer on live market pipeline...")
        # Prepare account and IPO dicts for the solver
        accounts_data = [
            {
                "id": a.id,
                "name": a.name,
                "relation": a.relation,
                "angel_client_id": a.angel_client_id,
                # Give a representative balance of ₹1.5L if available_liquid_balance is 0 for testing the solver
                "available_liquid_balance": a.available_liquid_balance if a.available_liquid_balance > 0 else 150000.0,
                "preferred_category": a.default_category_preference or "RETAIL",
                "is_active": a.is_active,
            }
            for a in db_accounts
        ]
        
        ipos_data = [
            {
                "id": ipo.id,
                "name": ipo.name,
                "symbol": ipo.symbol,
                "status": ipo.status,
                "issue_type": ipo.type,
                "issue_open_date": str(ipo.issue_open_date) if ipo.issue_open_date else None,
                "issue_close_date": str(ipo.issue_close_date) if ipo.issue_close_date else None,
                "listing_date": str(ipo.listing_date) if ipo.listing_date else None,
                "allotment_date": str(ipo.allotment_date) if ipo.allotment_date else None,
                "refund_date": str(ipo.refund_date) if ipo.refund_date else None,
                "min_investment": float(ipo.min_investment or 15000.0),
                "lot_size": int(ipo.lot_size or 1),
                "price_band_max": float(ipo.price_band_max or 100.0),
                "gmp_percent": float(ipo.gmp_percent or 15.0),
                "score": int(ipo.score or 50),
            }
            for ipo in active_ipos
        ]
        
        plan = AllocationOptimizer.solve_allocation(accounts_data, ipos_data)
        logger.info("Optimizer Solution Summary:")
        logger.info(f" -> Total Capital Deployed: ₹{plan.total_capital_deployed:,.2f}")
        logger.info(f" -> ASBA Lock Overlaps Detected: {plan.asba_lock_overlaps_detected}")
        logger.info(f" -> Total Allocated Applications: {len(plan.entries)}")
        for entry in plan.entries:
            logger.info(f"    * [{entry.account_name}] -> {entry.ipo_name} ({entry.category}): {entry.lots} lot(s) = ₹{entry.amount:,.2f} | Expected Return: +{entry.expected_return_pct}%")
            logger.info(f"      Rationale: {entry.reason}")
            
        if plan.upcoming_conflicts:
            logger.info(f" -> Upcoming Conflicts: {len(plan.upcoming_conflicts)} upcoming high-score issue(s) reserved.")
            for uc in plan.upcoming_conflicts:
                logger.info(f"    * {uc.upcoming_ipo_name} (Score {uc.upcoming_score}, +{uc.upcoming_gmp}% GMP) opens {uc.open_date}")
                
        logger.info("\n=== DRY RUN COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    asyncio.run(run_dryrun())

