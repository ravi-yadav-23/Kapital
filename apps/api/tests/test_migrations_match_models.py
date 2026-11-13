"""F26: `alembic upgrade head` must produce every table and column the models define.

Needs a real PostgreSQL (the migrations alter constraints, which SQLite cannot do). Sources, in order:
  1. MIGRATION_TEST_DATABASE_URL  (CI provides a throw-away Postgres service),
  2. an embedded Postgres from the optional `pgserver` package when USE_PGSERVER=1 (local runs),
else the tests are skipped.

Each test creates and drops its own database. For safety the tests REFUSE to run against hosted databases
(Supabase etc.): never point this at a database that holds real data.
"""
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text
from tests.postgres_fixtures import scratch_db, server_url  # noqa: F401  (pytest fixtures)

API = Path(__file__).resolve().parents[1]
def _cfg() -> Config:
    cfg = Config(str(API / "alembic.ini"))
    cfg.set_main_option("script_location", str(API / "alembic"))
    return cfg


def _structural_diffs(engine):
    from app.models.base import Base
    import app.models  # noqa: F401

    with engine.connect() as conn:
        diffs = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    out = []
    for d in diffs:
        for op in (d if isinstance(d, list) else [d]):
            kind = op[0]
            if kind in ("add_table", "remove_table", "add_column", "remove_column"):
                if kind.endswith("table"):
                    out.append(f"{kind}: {getattr(op[1], 'name', op[1])}")
                else:
                    out.append(f"{kind}: {op[2]}.{getattr(op[3], 'name', op[3])}")
    return out


def test_fresh_database_reaches_the_models(scratch_db):
    command.upgrade(_cfg(), "head")
    assert _structural_diffs(scratch_db) == []


def test_database_stuck_at_the_initial_migration_is_brought_up_to_date(scratch_db):
    """The existing production database is in this state (alembic_version = c13dc79076eb)."""
    command.upgrade(_cfg(), "c13dc79076eb")
    assert _structural_diffs(scratch_db), "sanity: the initial schema must be behind the models"
    command.upgrade(_cfg(), "head")
    assert _structural_diffs(scratch_db) == []


def test_upgrade_keeps_existing_rows_and_marks_old_reports_unaudited(scratch_db):
    command.upgrade(_cfg(), "c13dc79076eb")
    with scratch_db.begin() as c:
        c.execute(text(
            "INSERT INTO ipos (id, symbol, name, slug, type, status, price_band_min, price_band_max, lot_size, "
            "min_investment, issue_open_date, issue_close_date, created_at, updated_at) VALUES "
            "('m-1','MIG','Mig Ltd','mig-ltd','EQ','open',100,100,100,10000,now(),now(),now(),now())"))
        c.execute(text(
            "INSERT INTO ai_reports (id, ipo_id, overall_score, recommendation, executive_summary, created_at, updated_at) "
            "VALUES ('r-1','m-1',77,'STRONG_APPLY','old report',now(),now())"))
    command.upgrade(_cfg(), "head")
    with scratch_db.connect() as c:
        score, audited = c.execute(text("SELECT overall_score, is_audited FROM ai_reports WHERE id='r-1'")).one()
        assert score == 77
        assert audited is False, "pre-existing reports were never verified, so they must not be flagged audited"
        assert c.execute(text("SELECT count(*) FROM ipos")).scalar() == 1


def test_database_with_objects_created_outside_alembic_is_handled(scratch_db):
    """Production reality: the app created system_settings (and some columns) itself, while
    alembic_version stayed at the initial revision. The upgrade must not crash on 'already exists'."""
    command.upgrade(_cfg(), "c13dc79076eb")
    with scratch_db.begin() as c:
        c.execute(text(
            "CREATE TABLE system_settings (id VARCHAR(36) PRIMARY KEY, key VARCHAR(50) NOT NULL UNIQUE, "
            "value JSON NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL)"))
        c.execute(text("ALTER TABLE allotments ADD COLUMN angel_client_id VARCHAR(50)"))
        c.execute(text("ALTER TABLE allotments ADD CONSTRAINT uq_allotment_account_ipo UNIQUE (account_id, ipo_id)"))
        c.execute(text("INSERT INTO system_settings VALUES ('s-1','app_preferences','{}',now(),now())"))
    command.upgrade(_cfg(), "head")
    assert _structural_diffs(scratch_db) == []
    with scratch_db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM system_settings")).scalar() == 1
