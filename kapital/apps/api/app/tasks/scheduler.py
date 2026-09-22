import logging
from datetime import datetime, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings

logger = logging.getLogger("scheduler")

scheduler = AsyncIOScheduler()


async def morning_angel_one_login():
    """
    Runs at 08:30:00 AM IST every market day (Mon-Fri).
    1. Generates TOTP and logs into all configured Angel One family accounts.
    2. Obtains fresh JWT & feed tokens.
    3. Fetches live RMS limits and updates available balances in PostgreSQL.
    """
    logger.info("=== [08:30 AM IST] Executing Morning Angel One Multi-Account Login ===")
    from app.services.angel_service import angel_service
    from app.services.account_service import account_service
    from app.db.database import AsyncSessionLocal

    env_accounts = settings.angel_accounts
    if not env_accounts:
        logger.warning("No accounts found in ANGEL_ACCOUNTS_JSON for morning login.")
        return

    async with AsyncSessionLocal() as db:
        for acc in env_accounts:
            client_id = acc.get("client_id", "")
            name = acc.get("name", client_id)
            api_key = acc.get("api_key", "")
            pin = acc.get("pin", "")
            totp_secret = acc.get("totp_secret", "")

            try:
                # 1. Login with TOTP
                login_res = await angel_service.login_account(
                    client_id=client_id,
                    api_key=api_key,
                    pin=pin,
                    totp_secret=totp_secret,
                )
                logger.info(f"[{name}] SmartAPI morning login SUCCESS (JWT token active)")

                # 2. Sync RMS live balances to PostgreSQL
                await account_service.sync_live_balance(db, client_id)
                await db.commit()
                logger.info(f"[{name}] Opening RMS demat balance synced to database")
            except Exception as e:
                logger.error(f"[{name}] Morning login or RMS sync failed: {e}")


async def listing_day_premarket_execution():
    """
    Runs at 09:00:00 AM IST on market days (Mon-Fri).
    Checks if any active IPO holdings list today and dispatches pre-market limit sell orders.
    """
    logger.info("=== [09:00 AM IST] Checking Listing Day Pre-Market Sell Orders ===")
    from app.db.database import AsyncSessionLocal
    from app.models.allotment import Allotment
    from app.services.angel_service import angel_service
    from sqlalchemy import select

    today = date.today()
    async with AsyncSessionLocal() as db:
        stmt = select(Allotment).where(
            Allotment.status == "ACTIVE",
            Allotment.listing_date == today,
            Allotment.staged_sell_limit_price.isnot(None),
        )
        res = await db.execute(stmt)
        holdings = res.scalars().all()

        if not holdings:
            logger.info("No IPOs scheduled for pre-market listing sell today.")
            return

        for alt in holdings:
            logger.info(f"Triggering 09:00 AM sell order for {alt.ipo_symbol}: {alt.allotted_shares} shares @ ₹{alt.staged_sell_limit_price}")
            try:
                client_code = alt.angel_client_id
                if not client_code:
                    from app.models.account import FamilyAccount
                    acc_res = await db.execute(select(FamilyAccount).where(FamilyAccount.id == alt.account_id))
                    acc = acc_res.scalar_one_or_none()
                    if acc and acc.angel_client_id:
                        client_code = acc.angel_client_id
                        alt.angel_client_id = client_code

                order_res = await angel_service.stage_listing_sell_order(
                    client_id=client_code or alt.account_name,
                    symbol=alt.ipo_symbol,
                    shares=alt.allotted_shares,
                    limit_price=alt.staged_sell_limit_price,
                )
                alt.sell_order_id = order_res.get("sell_order_id")
                await db.flush()
                logger.info(f"[{alt.ipo_symbol}] Sell order placed: {alt.sell_order_id}")
            except Exception as e:
                logger.error(f"[{alt.ipo_symbol}] Failed to dispatch listing sell order: {e}")
        await db.commit()


async def daily_ipo_scraper_sync():
    """
    Runs at 05:00:00 PM IST on market days (Mon-Fri).
    Updates closing subscriptions, grey market premiums, and ingests newly announced IPO issues.
    """
    logger.info("=== [05:00 PM IST] Running Daily Post-Market IPO Scraper Sync ===")
    from app.db.database import AsyncSessionLocal
    from app.tasks.ipo_tasks import sync_ipos_pipeline

    async with AsyncSessionLocal() as db:
        try:
            count = await sync_ipos_pipeline(db)
            logger.info(f"Evening IPO sync complete: {count} issues synchronized.")
        except Exception as e:
            logger.error(f"Evening IPO sync failed: {e}")


async def daily_asba_and_reports_maintenance():
    """
    Runs at 22:00:00 IST every day.
    1. Sweeps and releases expired ASBA locks.
    2. Runs batch multi-agent due diligence dossiers for newly added IPOs.
    """
    logger.info("=== [10:00 PM IST] Running Daily ASBA Sweep & Batch AI Reports ===")
    from app.db.database import AsyncSessionLocal
    from app.tasks.order_tasks import sync_expired_asba_locks
    from app.tasks.report_tasks import generate_nightly_ipo_dossiers

    async with AsyncSessionLocal() as db:
        try:
            await sync_expired_asba_locks(db)
        except Exception as e:
            logger.error(f"Expired ASBA lock sweep error: {e}")

        try:
            await generate_nightly_ipo_dossiers(db)
        except Exception as e:
            logger.error(f"Nightly report generation error: {e}")


def start_scheduler():
    """Initialize and start the background cron scheduler."""
    if scheduler.running:
        return

    # Job 1: 08:30 AM IST Mon-Fri (SmartAPI Morning Login & RMS Sync)
    scheduler.add_job(
        morning_angel_one_login,
        trigger=CronTrigger(hour=8, minute=30, day_of_week="mon-fri", timezone="Asia/Kolkata"),
        id="morning_angel_one_login",
        replace_existing=True,
    )

    # Job 2: 09:00 AM IST Mon-Fri (Listing Day Pre-Market Limit Sell Execution)
    scheduler.add_job(
        listing_day_premarket_execution,
        trigger=CronTrigger(hour=9, minute=0, second=0, day_of_week="mon-fri", timezone="Asia/Kolkata"),
        id="listing_day_premarket_execution",
        replace_existing=True,
    )

    # Job 3: 05:00 PM IST Mon-Fri (Post-Market Public Feeds Scraper Sync)
    scheduler.add_job(
        daily_ipo_scraper_sync,
        trigger=CronTrigger(hour=17, minute=0, day_of_week="mon-fri", timezone="Asia/Kolkata"),
        id="daily_ipo_scraper_sync",
        replace_existing=True,
    )

    # Job 4: 10:00 PM IST Daily (Nightly ASBA lock sweep & Multi-Agent dossiers)
    scheduler.add_job(
        daily_asba_and_reports_maintenance,
        trigger=CronTrigger(hour=22, minute=0, timezone="Asia/Kolkata"),
        id="daily_asba_and_reports_maintenance",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Kapitl background scheduler started (08:30 AM Login | 09:00 AM Sell | 05:00 PM Scrape | 10:00 PM Maintenance)")


def stop_scheduler():
    """Shutdown background scheduler cleanly on application termination."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Kapitl background scheduler stopped.")
