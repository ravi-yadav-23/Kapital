import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ── Path setup: make `app` importable ────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# ── Load .env so DATABASE_URL is available ───────────────────────────────────
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

# ── Import all models so Alembic autogenerate detects them ───────────────────
from app.models.base import Base          # This is the REAL Base all models inherit from
import app.models            # noqa: F401  (registers EVERY model so autogenerate/compare see them all)

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url with the real DATABASE_URL from .env
DATABASE_URL = os.environ.get("DATABASE_URL", "")
# Alembic needs synchronous driver for migrations — convert asyncpg → psycopg2
SYNC_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
# configparser treats "%" as interpolation, so percent-encoded URLs must be escaped
config.set_main_option("sqlalchemy.url", SYNC_URL.replace("%", "%%"))


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # A caller may hand in its own connection (e.g. scripts/db_dry_run.py runs the upgrade inside a
    # transaction it rolls back afterwards).
    provided = config.attributes.get("connection")
    if provided is not None:
        do_run_migrations(provided)
        return

    sync_url = config.get_main_option("sqlalchemy.url")
    from sqlalchemy import create_engine
    connectable = create_engine(sync_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
