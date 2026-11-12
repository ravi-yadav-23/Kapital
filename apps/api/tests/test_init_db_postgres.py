"""F27: start-up schema code must be safe on PostgreSQL (an aborted ALTER used to roll back create_all)."""
import asyncio

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.database import init_db
from tests.postgres_fixtures import scratch_db, server_url  # noqa: F401  (pytest fixtures)
from tests.test_migrations_match_models import _cfg


def _async_url(sync_engine) -> str:
    return make_url(sync_engine.url.render_as_string(hide_password=False)).set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)


def _run_init(sync_engine):
    async def go():
        eng = create_async_engine(_async_url(sync_engine))
        try:
            await init_db(eng)
        finally:
            await eng.dispose()

    asyncio.run(go())


def test_init_db_creates_all_tables_on_an_empty_postgres(scratch_db):
    _run_init(scratch_db)
    tables = set(inspect(scratch_db).get_table_names())
    assert {"ipos", "ai_reports", "family_accounts", "ipo_orders", "allotments", "score_history"} <= tables


def test_init_db_does_not_break_a_migrated_postgres_or_its_data(scratch_db):
    command.upgrade(_cfg(), "head")
    with scratch_db.begin() as c:
        c.execute(text(
            "INSERT INTO ipos (id, symbol, name, slug, type, status, price_band_min, price_band_max, lot_size, "
            "min_investment, issue_open_date, issue_close_date, created_at, updated_at) VALUES "
            "('i-1','KEEP','Keep Ltd','keep-ltd','EQ','open',100,100,100,10000,now(),now(),now(),now())"))
    _run_init(scratch_db)
    with scratch_db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM ipos")).scalar() == 1


def test_init_db_is_safe_before_migrations_and_migrations_still_work_after(scratch_db):
    """Start-up code must not leave a half-applied schema that later makes `alembic upgrade head` fail."""
    _run_init(scratch_db)
    command.upgrade(_cfg(), "head")  # must not raise 'already exists'
    assert "score_history" in set(inspect(scratch_db).get_table_names())
