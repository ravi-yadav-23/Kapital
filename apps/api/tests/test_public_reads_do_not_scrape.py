"""M2: public IPO reads must never trigger outbound scraping (any visitor could otherwise make the server hit
third-party sites, and a cold start would block on them)."""
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.db.database import get_db
from app.main import app
from app.models.base import Base


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
    yield
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


@pytest.mark.asyncio
async def test_listing_ipos_on_an_empty_database_does_not_scrape(empty_db):
    boom = AsyncMock(side_effect=AssertionError("a public read triggered a live scrape"))
    with patch("app.tasks.ipo_tasks.sync_ipos_pipeline", new=boom):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/api/ipos")
    assert resp.status_code == 200 and resp.json() == []
    boom.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_ipo_is_a_plain_404_without_scraping(empty_db):
    boom = AsyncMock(side_effect=AssertionError("a public read triggered a live scrape"))
    with patch("app.tasks.ipo_tasks.sync_ipos_pipeline", new=boom):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/api/ipos/does-not-exist")
    assert resp.status_code == 404
    boom.assert_not_awaited()
