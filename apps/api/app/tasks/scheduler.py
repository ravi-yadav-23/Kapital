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

    # Refresh OpenAPI Scrip Master to guarantee today's newly listed IPO tokens are loaded
    try:
        scrip_count = await angel_service.refresh_scrip_master(force=True)
        logger.info(f"[08:30 AM IST] Pre-market Angel One scrip master refreshed: {scrip_count} instruments ready")
    except Exception as scrip_err:
        logger.warning(f"Could not refresh scrip master at 08:30 AM: {scrip_err}")

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
    On success, records realized P&L to the realized_pnl ledger table.
    """
    logger.info("=== [09:00 AM IST] Checking Listing Day Pre-Market Sell Orders ===")
    from app.db.database import AsyncSessionLocal
    from app.models.allotment import Allotment
    from app.services.angel_service import angel_service
    from app.services.pnl_service import pnl_service
    from sqlalchemy import select

    today = date.today()
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(Allotment).where(
                Allotment.status.in_(["ACTIVE", "STAGED"]),
                Allotment.listing_date == today,
                Allotment.staged_sell_limit_price.isnot(None),
                Allotment.sell_order_id.is_(None),
            )
            res = await db.execute(stmt)
            holdings = res.scalars().all()

            if not holdings:
                logger.info("No IPOs scheduled for pre-market listing sell today.")
                return

            for alt in holdings:
                logger.info(f"Triggering 09:00 AM sell order for {alt.ipo_symbol}: {alt.allotted_shares} shares @ ₹{alt.staged_sell_limit_price}")
                try:
                    # Intermediate status before broker dispatch
                    alt.status = "SELL_SUBMITTED"
                    await db.flush()

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
                    if order_res.get("success"):
                        alt.sell_order_id = order_res.get("sell_order_id")
                        alt.status = "STAGED"
                        await db.flush()
                        logger.info(f"[{alt.ipo_symbol}] Sell order placed successfully: {alt.sell_order_id}")

                        # Record realized P&L — use staged limit price as exit price
                        exit_px = float(alt.staged_sell_limit_price or 0.0)
                        if exit_px > 0:
                            await pnl_service.record_sell(db, alt, exit_px, exit_type="PRE_MARKET_LISTING")
                            logger.info(f"[{alt.ipo_symbol}] P&L recorded at exit price ₹{exit_px}")
                    else:
                        alt.status = "ACTIVE"
                        await db.flush()
                        err_msg = order_res.get("message") or order_res.get("error", "Unknown error")
                        logger.error(f"[{alt.ipo_symbol}] Listing sell order FAILED at broker: {err_msg}")
                except Exception as e:
                    alt.status = "ACTIVE"
                    await db.flush()
                    logger.error(f"[{alt.ipo_symbol}] Exception while dispatching listing sell order: {e}")
            await db.commit()
    except Exception as job_err:
        logger.error(f"listing_day_premarket_execution job failed: {job_err}")


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
            from app.services.allotment_service import allotment_service
            allot_res = await allotment_service.auto_detect_allotments(db)
            logger.info(f"Nightly allotment broker scan result: {allot_res}")
        except Exception as e:
            logger.error(f"Nightly allotment detection error: {e}")

        try:
            await sync_expired_asba_locks(db)
        except Exception as e:
            logger.error(f"Expired ASBA lock sweep error: {e}")

        try:
            await generate_nightly_ipo_dossiers(db)
        except Exception as e:
            logger.error(f"Nightly report generation error: {e}")


async def intraday_subscription_sync():
    """
    Runs every 30 minutes from 10:00 AM to 4:30 PM IST on market days.
    Fetches live subscription multipliers (QIB, sHNI, bHNI, Retail, Total)
    for all currently OPEN IPOs and persists updated values to PostgreSQL.
    This ensures the score engine and optimizer use current subscription data,
    not stale 0.0 values from the previous day's sync.
    """
    logger.info("=== [Intraday] Live Subscription Sync for Open IPOs ===")
    from app.db.database import AsyncSessionLocal
    from app.tasks.ipo_tasks import sync_open_ipo_subscriptions

    try:
        async with AsyncSessionLocal() as db:
            count = await sync_open_ipo_subscriptions(db)
            if count:
                logger.info(f"[Intraday Sub-Sync] Updated subscription metrics for {count} open IPO(s).")
    except Exception as e:
        logger.error(f"[Intraday Sub-Sync] Failed: {e}")


async def periodic_allotment_detection():
    """
    Runs every 30 minutes from 6:00 AM to 8:00 PM IST on market days.
    Polls Angel One demat holdings for all family accounts whose IPO allotment
    date falls within the T+3 to T+7 window, auto-marking allotted/not-allotted.
    This replaces the previous once-per-night detection with proper 30-min polling
    so the pre-listing sell scheduler at 09:00 AM sees correct ACTIVE allotments.
    """
    logger.info("=== [30m Poll] Periodic Allotment Auto-Detection ===")
    from app.db.database import AsyncSessionLocal
    from app.services.allotment_service import allotment_service
    from app.models.order import Order
    from app.models.ipo import Ipo
    from sqlalchemy import select
    from datetime import timedelta

    try:
        async with AsyncSessionLocal() as db:
            today = date.today()
            # Only scan orders in the T+3 to T+7 window
            stmt = (
                select(Order)
                .join(Ipo, Order.ipo_id == Ipo.id)
                .where(
                    Order.status.in_(["SUBMITTED", "CONFIRMED", "APPLIED"]),
                    Ipo.allotment_date.isnot(None),
                    Ipo.allotment_date <= today,
                    Ipo.allotment_date >= (today - timedelta(days=7)),
                )
            )
            res = await db.execute(stmt)
            pending_orders = res.scalars().all()

            if not pending_orders:
                logger.info("[Allotment Poll] No orders in detection window.")
                return

            logger.info(f"[Allotment Poll] Checking {len(pending_orders)} order(s) for allotment status...")
            result = await allotment_service.auto_detect_allotments(db)
            logger.info(
                f"[Allotment Poll] Allotted: {result['allotted']} | "
                f"Not Allotted: {result['not_allotted']} | "
                f"Pending: {result['pending']}"
            )
    except Exception as e:
        logger.error(f"[Allotment Poll] Failed: {e}")


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

    # Job 5: Every 30 mins 10:00 AM–5:00 PM IST Mon-Fri (Live subscription metrics for open IPOs)
    scheduler.add_job(
        intraday_subscription_sync,
        trigger=CronTrigger(hour="10-16", minute="*/30", day_of_week="mon-fri", timezone="Asia/Kolkata"),
        id="intraday_subscription_sync",
        replace_existing=True,
    )

    # Job 6: Every 30 mins 6:00 AM–8:00 PM IST Mon-Fri (Auto-detect allotments T+3 to T+7)
    scheduler.add_job(
        periodic_allotment_detection,
        trigger=CronTrigger(hour="6-20", minute="*/30", day_of_week="mon-fri", timezone="Asia/Kolkata"),
        id="periodic_allotment_detection",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "Kapitl background scheduler started: "
        "08:30 AM Login | 09:00 AM Sell | "
        "10 AM–5 PM Sub-Sync (30m) | "
        "6 AM–8 PM Allotment-Detect (30m) | "
        "05:00 PM Scrape | 10:00 PM Maintenance"
    )


def stop_scheduler():
    """Shutdown background scheduler cleanly on application termination."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Kapitl background scheduler stopped.")
