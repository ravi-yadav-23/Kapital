"""M2: the sync pipeline uses the source runner and no longer calls the LLM; the subscription job works."""
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import app
from app.middleware.auth import create_access_token
from app.models.ipo import Ipo
from app.models.score_history import ScoreHistory
from app.models.source_health import SourceHealth
from app.sources.base import Source, SourceResult
from app.sources.runner import run_sources
from app.tasks.ipo_tasks import sync_ipos_pipeline, sync_open_ipo_subscriptions


class OneShot(Source):
    name = "t_oneshot"
    empty_is_normal = True

    def __init__(self, records, budget=None, used=1):
        self._records = records
        self.daily_request_budget = budget
        self._used = used
        self.calls = 0

    def enabled(self):
        return True

    async def fetch(self, *, requests_allowed=None):
        self.calls += 1
        return SourceResult(records=self._records, requests_used=self._used)


def _rec(symbol, **kw):
    base = dict(symbol=symbol, name=f"{symbol} Industries Ltd", slug=symbol.lower(), type="EQ", status="open",
                price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=date.today().isoformat(), issue_close_date=date.today().isoformat())
    base.update(kw)
    return base


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        ids = [i for (i,) in (await s.execute(select(Ipo.id).where(Ipo.symbol.like("SYN%")))).all()]
        if ids:
            await s.execute(delete(ScoreHistory).where(ScoreHistory.ipo_id.in_(ids)))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("SYN%")))
        await s.execute(delete(SourceHealth).where(SourceHealth.source.like("t_%")))
        await s.commit()


@pytest.mark.asyncio
async def test_sync_never_calls_the_llm(db):
    boom = AsyncMock(side_effect=AssertionError("the sync must not spend LLM tokens"))
    with patch("app.services.report_service.report_service.get_or_generate_report", new=boom):
        n = await sync_ipos_pipeline(db, sources=[OneShot([_rec("SYNA")])])
    assert n == 1
    boom.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_reports_how_many_ipos_were_stored(db):
    n = await sync_ipos_pipeline(db, sources=[OneShot([_rec("SYNB"), _rec("SYNC")])])
    assert n == 2


@pytest.mark.asyncio
async def test_subscription_job_updates_open_ipos_and_keeps_known_categories(db):
    db.add(Ipo(id="syn-1", symbol="SYND", name="Syn D Ltd", slug="syn-d", type="EQ", status="open",
               price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
               issue_open_date=date.today(), issue_close_date=date.today(),
               subscription_qib=5.0, subscription_total=1.0, gmp_percent=20.0))
    await db.commit()
    src = OneShot([{"symbol": "SYND", "subscription_total": 3.2}])
    updated = await sync_open_ipo_subscriptions(db, source=src)
    assert updated == 1
    ipo = (await db.execute(select(Ipo).where(Ipo.id == "syn-1"))).scalar_one()
    assert ipo.subscription_total == 3.2
    assert ipo.subscription_qib == 5.0, "a category the source does not report must not be zeroed"
    # the stored score follows the new data and the change is logged
    hist = (await db.execute(select(ScoreHistory).where(ScoreHistory.ipo_id == "syn-1"))).scalars().all()
    assert hist and "subscription 3.2x" in hist[-1].reason


@pytest.mark.asyncio
async def test_subscription_job_does_not_crash_with_no_open_ipos(db):
    assert await sync_open_ipo_subscriptions(db, source=OneShot([])) == 0


@pytest.mark.asyncio
async def test_subscription_job_respects_the_daily_request_budget(db):
    db.add(Ipo(id="syn-2", symbol="SYNE", name="Syn E Ltd", slug="syn-e", type="EQ", status="open",
               price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
               issue_open_date=date.today(), issue_close_date=date.today()))
    await db.commit()
    src = OneShot([{"symbol": "SYNE", "subscription_total": 2.0}], budget=1, used=1)
    assert await sync_open_ipo_subscriptions(db, source=src) == 1
    assert await sync_open_ipo_subscriptions(db, source=src) == 0
    assert src.calls == 1


@pytest.mark.asyncio
async def test_source_health_endpoint_is_admin_only_and_lists_sources(db):
    await run_sources(db, [OneShot([_rec("SYNF")])])
    await db.commit()
    admin = {"Authorization": "Bearer " + create_access_token({"sub": "admin-1", "role": "ADMIN", "is_guest": False})}
    guest = {"Authorization": "Bearer " + create_access_token({"sub": "g", "role": "GUEST", "is_guest": True})}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/api/sources/health")).status_code == 401
        assert (await c.get("/api/sources/health", headers=guest)).status_code == 403
        ok = await c.get("/api/sources/health", headers=admin)
    assert ok.status_code == 200
    row = next(r for r in ok.json() if r["source"] == "t_oneshot")
    assert row["status"] == "ok" and row["last_record_count"] == 1 and row["consecutive_failures"] == 0
