"""F23: public report routes must be read-only and must not spend LLM/scrape budget for anonymous callers."""
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.db.database import get_db
from app.main import app
from app.middleware.auth import create_access_token
from app.models.base import Base
from app.models.ipo import Ipo


@pytest_asyncio.fixture
async def empty_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _db():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    yield maker
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_list_reports_on_empty_db_does_not_scrape(empty_db):
    boom = AsyncMock(side_effect=AssertionError("live scrape triggered by a public GET"))
    with patch("app.tasks.ipo_tasks.sync_ipos_pipeline", new=boom):
        async with _client() as c:
            resp = await c.get("/api/reports")
    assert resp.status_code == 200 and resp.json() == []
    boom.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_unknown_report_is_404_and_writes_nothing(empty_db):
    boom = AsyncMock(side_effect=AssertionError("DB seeded by a public GET"))
    with patch("app.db.seed_data.seed_initial_ipos_and_reports", new=boom):
        async with _client() as c:
            resp = await c.get("/api/reports/does-not-exist")
    assert resp.status_code == 404
    async with empty_db() as s:
        assert (await s.execute(select(func.count(Ipo.id)))).scalar() == 0


async def _seed_ipo(maker):
    async with maker() as s:
        s.add(Ipo(id="rp-ipo", symbol="RPT", name="Rpt Ltd", slug="rpt", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0))
        await s.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer junk"}])
async def test_anonymous_generate_never_calls_the_llm(empty_db, headers):
    await _seed_ipo(empty_db)
    llm = AsyncMock(side_effect=AssertionError("LLM called for a non-admin caller"))
    with patch("app.routers.reports.report_service.get_or_generate_report", new=llm):
        async with _client() as c:
            resp = await c.post("/api/reports/rp-ipo/generate", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_audited"] is False
    llm.assert_not_awaited()


@pytest.mark.asyncio
async def test_guest_generate_never_calls_the_llm(empty_db):
    await _seed_ipo(empty_db)
    tok = create_access_token({"sub": "g", "role": "GUEST", "is_guest": True})
    llm = AsyncMock(side_effect=AssertionError("LLM called for a guest"))
    with patch("app.routers.reports.report_service.get_or_generate_report", new=llm):
        async with _client() as c:
            resp = await c.post("/api/reports/rp-ipo/generate", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 200
    llm.assert_not_awaited()


@pytest.mark.asyncio
async def test_admin_generate_does_call_the_pipeline(empty_db):
    await _seed_ipo(empty_db)
    tok = create_access_token({"sub": "admin-1", "role": "ADMIN", "is_guest": False})
    sentinel = AsyncMock(side_effect=RuntimeError("reached"))
    with patch("app.routers.reports.report_service.get_or_generate_report", new=sentinel):
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
            await c.post("/api/reports/rp-ipo/generate", headers={"Authorization": f"Bearer {tok}"})
    sentinel.assert_awaited()
