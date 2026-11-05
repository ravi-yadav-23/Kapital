import asyncio
import logging

from app.config import settings

logger = logging.getLogger("celery.app")

try:
    from celery import Celery
    from celery.schedules import crontab
    CELERY_AVAILABLE = True

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
    celery.conf.beat_schedule = {}
except ImportError:
    CELERY_AVAILABLE = False
    logger.info("Celery is not installed in the current environment; running tasks with fallback handlers.")

    class _DummyCelery:
        def task(self, *args, **kwargs):
            def decorator(f):
                class _TaskWrapper:
                    def __init__(self, fn):
                        self.fn = fn
                    def __call__(self, *a, **kw):
                        return self.fn(*a, **kw)
                    def apply_async(self, *a, **kw):
                        raise RuntimeError("Celery is not installed in this environment.")
                return _TaskWrapper(f)
            return decorator

    celery = _DummyCelery()


# ── Celery Task Definitions ───────────────────────────────────────────────────

@celery.task(name="app.tasks.celery_app.dispatch_listing_sells_celery", bind=True, max_retries=3)
def dispatch_listing_sells_celery(self):
    """Celery task: Execute 09:00:00 AM IST pre-listing sell orders."""
    logger.info("Executing Celery task: dispatch_listing_sells")

    async def _run():
        from app.db.database import AsyncSessionLocal
        from app.tasks.allotment_tasks import run_listing_day_sell_staging
        async with AsyncSessionLocal() as db:
            return await run_listing_day_sell_staging(db)

    try:
        return asyncio.run(_run())
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


@celery.task(name="app.tasks.celery_app.run_optimizer_celery", bind=True, max_retries=1, time_limit=120)
def run_optimizer_celery(self, accounts_data: list, ipos_data: list, is_demo: bool = False):
    """
    Celery task: Run PuLP MILP optimizer in a background worker process.
    Returns the allocation plan as a JSON-serializable dict.
    """
    logger.info(f"Running MILP optimizer: {len(accounts_data)} accounts, {len(ipos_data)} IPOs")
    try:
        from app.services.optimizer_service import AllocationOptimizer
        plan = AllocationOptimizer.solve_allocation(
            accounts=accounts_data,
            ipos=ipos_data,
        )
        result = plan.model_dump()  # Convert Pydantic model to dict for JSON serialization
        if is_demo:
            result["is_demo"] = True
            result["warnings"] = [
                "DEMO MODE: Showing sample allocation plan with demo family accounts. Add your real family accounts to see your personalized allocation."
            ] + result.get("warnings", [])
        return result
    except Exception as exc:
        logger.error(f"Optimizer task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=0, max_retries=0)
