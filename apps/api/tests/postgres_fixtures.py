"""Shared PostgreSQL fixtures: a throw-away server (CI service or embedded pgserver) and a database per test.

For safety these REFUSE hosted databases (Supabase etc.): never point tests at a database holding real data.
"""
import os
import tempfile
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

FORBIDDEN_HOST_PARTS = ("supabase", "pooler", "neon.tech", "amazonaws", "azure", "render.com")


def _sync(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


@pytest.fixture(scope="module")
def server_url():
    url = os.environ.get("MIGRATION_TEST_DATABASE_URL", "")
    if url:
        host = (make_url(_sync(url)).host or "").lower()
        assert not any(p in host for p in FORBIDDEN_HOST_PARTS), (
            f"refusing to run migration tests against a hosted database ({host})"
        )
        yield _sync(url)
        return
    if not os.environ.get("USE_PGSERVER"):
        pytest.skip("Postgres tests are opt-in locally: set USE_PGSERVER=1 (embedded pgserver) "
                    "or MIGRATION_TEST_DATABASE_URL (CI provides one)")
    try:
        import pgserver
    except ImportError:
        pytest.skip("pip install pgserver (see requirements-dev.txt) to run the Postgres tests locally")
    with tempfile.TemporaryDirectory(prefix="kapitl_pg_") as d:
        srv = pgserver.get_server(Path(d))
        try:
            yield _sync(srv.get_uri())
        finally:
            srv.cleanup()


@pytest.fixture
def scratch_db(server_url, monkeypatch):
    name = f"mig_{uuid.uuid4().hex[:10]}"
    admin = create_engine(server_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    scoped = make_url(server_url).set(database=name).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", scoped)
    engine = create_engine(scoped)
    yield engine
    engine.dispose()
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
    admin.dispose()


