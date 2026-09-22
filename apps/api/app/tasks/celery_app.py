import asyncio
import logging
from celery import Celery
from celery.schedules import crontab

from app.config import settings

logger = logging.getLogger("celery.app")

# Initialize Celery app
celery = Celery(
    "kapitl",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

# Configure Celery
celery.conf.update(
    timezone="Asia/Kolkata",
    enable_utc=False,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
)

# Note: Periodic scheduling is managed natively in-process by APScheduler (app.tasks.scheduler)
# to avoid requiring external Redis/Celery beat services for routine execution.
celery.conf.beat_schedule = {}


# ── Celery Task Definitions ───────────────────────────────────────────────────

@celery.task(name="app.tasks.celery_app.dispatch_listing_sells_celery", bind=True, max_retries=3)
def dispatch_listing_sells_celery(self):
    """Celery task: Execute 09:00:00 AM IST pre-listing sell orders."""
    logger.info("Executing Celery task: dispatch_listing_sells")
    try:
        from app.tasks.allotment_tasks import dispatch_listing_sells
        return asyncio.run(dispatch_listing_sells())
    except Exception as exc:
        logger.error(f"dispatch_listing_sells failed: {exc}")
        raise self.retry(exc=exc, countdown=15)


@celery.task(name="app.tasks.celery_app.sync_ipos_celery", bind=True, max_retries=3)
def sync_ipos_celery(self):
    """Celery task: Sync latest IPOs, subscription metrics, and GMP."""
    logger.info("Executing Celery task: sync_ipos")
    try:
        from app.tasks.ipo_tasks import sync_ipos_task
        return asyncio.run(sync_ipos_task())
    except Exception as exc:
        logger.error(f"sync_ipos failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery.task(name="app.tasks.celery_app.asba_sweep_celery", bind=True, max_retries=2)
def asba_sweep_celery(self):
    """Celery task: Release expired ASBA fund locks."""
    logger.info("Executing Celery task: asba_sweep")
    try:
        from app.tasks.order_tasks import clean_expired_asba_locks
        return asyncio.run(clean_expired_asba_locks())
    except Exception as exc:
        logger.error(f"asba_sweep failed: {exc}")
        raise self.retry(exc=exc, countdown=120)


@celery.task(name="app.tasks.celery_app.reconcile_funds_celery", bind=True, max_retries=2)
def reconcile_funds_celery(self):
    """Celery task: Reconcile family balances and fund utilization."""
    logger.info("Executing Celery task: reconcile_funds")
    try:
        from app.tasks.fund_tasks import reconcile_family_funds
        return asyncio.run(reconcile_family_funds())
    except Exception as exc:
        logger.error(f"reconcile_funds failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery.task(name="app.tasks.celery_app.nightly_reports_celery", bind=True, max_retries=2)
def nightly_reports_celery(self):
    """Celery task: Run multi-agent due diligence pipeline on active IPOs."""
    logger.info("Executing Celery task: nightly_reports")
    try:
        from app.tasks.report_tasks import generate_nightly_reports
        return asyncio.run(generate_nightly_reports())
    except Exception as exc:
        logger.error(f"nightly_reports failed: {exc}")
        raise self.retry(exc=exc, countdown=300)
