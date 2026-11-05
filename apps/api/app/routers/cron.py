"""
cron.py — Webhook Router for Serverless Cron Execution
======================================================
Exposes secure HTTP trigger endpoints for external schedulers (Vercel Cron,
GitHub Actions, CloudWatch, or cron-job.org) so that critical market routines
(08:30 AM login, 09:00 AM pre-market exit, 10:05 AM reconciliation, 30m allotment poll)
execute reliably even in serverless deployments where in-process APScheduler cannot run.
"""

import logging
from fastapi import APIRouter, HTTPException, Header, Depends, status
from typing import Optional
import secrets

from app.config import settings

logger = logging.getLogger("router.cron")


def _verify_cron_auth(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    """
    Validates that incoming webhook trigger originates from an authorized scheduler.
    Accepts:
    1. 'Authorization: Bearer <MASTER_API_KEY>' or '<SECRET_KEY>'
    2. 'X-API-Key: <MASTER_API_KEY>' or '<SECRET_KEY>'
    """
    expected_key = (settings.master_api_key or "").strip() or (settings.secret_key or "").strip()
    if not expected_key:
        return True  # Open in unconfigured dev environment

    provided_token = ""
    if authorization and authorization.startswith("Bearer "):
        provided_token = authorization.split("Bearer ", 1)[1].strip()
    elif x_api_key:
        provided_token = x_api_key.strip()

    if not provided_token or not secrets.compare_digest(provided_token.encode(), expected_key.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid cron authorization secret required.",
        )
    return True


router = APIRouter(
    prefix="/cron",
    tags=["cron"],
    dependencies=[Depends(_verify_cron_auth)],
)


@router.post("/morning-login")
async def trigger_morning_login():
    """Trigger 08:30 AM IST Angel One Multi-Account Login & Opening RMS balance sync."""
    from app.tasks.scheduler import morning_angel_one_login
    logger.info("[Cron Webhook] Received trigger: morning_angel_one_login")
    await morning_angel_one_login()
    return {"status": "SUCCESS", "job": "morning_angel_one_login"}


@router.post("/listing-sell")
async def trigger_listing_sell():
    """Trigger 09:00 AM IST Listing Day Pre-Market Limit Sell Order execution."""
    from app.tasks.scheduler import listing_day_premarket_execution
    logger.info("[Cron Webhook] Received trigger: listing_day_premarket_execution")
    await listing_day_premarket_execution()
    return {"status": "SUCCESS", "job": "listing_day_premarket_execution"}


@router.post("/reconcile-sells")
async def trigger_reconcile_sells():
    """Trigger 10:05 AM IST Listing Sell Fill Reconciliation & Realized P&L booking."""
    from app.tasks.scheduler import reconcile_listing_sells
    logger.info("[Cron Webhook] Received trigger: reconcile_listing_sells")
    await reconcile_listing_sells()
    return {"status": "SUCCESS", "job": "reconcile_listing_sells"}


@router.post("/allotment-poll")
async def trigger_allotment_poll():
    """Trigger 30-min Periodic Allotment Detection across broker holdings."""
    from app.tasks.scheduler import periodic_allotment_detection
    logger.info("[Cron Webhook] Received trigger: periodic_allotment_detection")
    await periodic_allotment_detection()
    return {"status": "SUCCESS", "job": "periodic_allotment_detection"}


@router.post("/daily-scrape")
async def trigger_daily_scrape():
    """Trigger 05:00 PM IST Market Feeds Scraper Sync."""
    from app.tasks.scheduler import daily_ipo_scraper_sync
    logger.info("[Cron Webhook] Received trigger: daily_ipo_scraper_sync")
    await daily_ipo_scraper_sync()
    return {"status": "SUCCESS", "job": "daily_ipo_scraper_sync"}


@router.post("/nightly-maintenance")
async def trigger_nightly_maintenance():
    """Trigger 10:00 PM IST ASBA Sweep & Multi-Agent Due Diligence dossiers."""
    from app.tasks.scheduler import daily_asba_and_reports_maintenance
    logger.info("[Cron Webhook] Received trigger: daily_asba_and_reports_maintenance")
    await daily_asba_and_reports_maintenance()
    return {"status": "SUCCESS", "job": "daily_asba_and_reports_maintenance"}
