"""The global daily audit cap holds under real concurrency (needs PostgreSQL: opt-in USE_PGSERVER=1 / CI service)."""
import asyncio

from alembic import command
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.routers.analysis import _take_click
from tests.postgres_fixtures import scratch_db, server_url  # noqa: F401  (pytest fixtures)
from tests.test_migrations_match_models import _cfg


def test_cap_is_not_overshot_by_concurrent_clicks(scratch_db):
    command.upgrade(_cfg(), "head")
    url = make_url(scratch_db.url.render_as_string(hide_password=False)).set(drivername="postgresql+asyncpg")

    async def go():
        eng = create_async_engine(url.render_as_string(hide_password=False), pool_size=12)
        maker = async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)

        async def click():
            async with maker() as s:
                ok = await _take_click(s, 3)
                await s.commit()
                return ok

        try:
            return await asyncio.gather(*[click() for _ in range(12)])
        finally:
            await eng.dispose()

    results = asyncio.run(go())
    assert results.count(True) == 3
    with scratch_db.connect() as c:
        assert c.execute(text("SELECT used FROM audit_quota")).scalar_one() == 3
