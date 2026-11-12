import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.base import Base
import app.models  # Ensures all models and tables are registered
from app.config import settings

logger = logging.getLogger("database")

# ── Build async engine URL ─────────────────────────────────────────────────────
db_url = settings.database_url or ""

if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
if "sslmode=require" in db_url:
    db_url = db_url.replace("sslmode=require", "ssl=require")

def _build_engine(url: str):
    try:
        if "sslmode=require" in url:
            url = url.replace("sslmode=require", "ssl=require")
        if "supabase" in url or "pooler" in url:
            return create_async_engine(
                url,
                echo=False,
                pool_pre_ping=True,
                connect_args={"statement_cache_size": 0, "command_timeout": 15.0, "timeout": 15.0},
            )
        elif url.startswith("sqlite"):
            if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
                # Serverless working directory is read-only; use /tmp
                url = "sqlite+aiosqlite:////tmp/kapitl_local.db"
            return create_async_engine(url, echo=False)
        else:
            return create_async_engine(url, echo=False, pool_pre_ping=True)
    except Exception as e:
        if getattr(settings, "environment", "") == "production":
            logger.critical(f"[DB FATAL] Cannot connect to primary database in production: {e}")
            raise RuntimeError(
                f"Production database initialization failed: {e}. SQLite fallback is strictly disabled in production."
            )
        logger.error(f"[DB Error] Failed to create engine for {url}: {e}. Falling back to SQLite on /tmp")
        fallback_url = "sqlite+aiosqlite:////tmp/kapitl_local.db"
        return create_async_engine(fallback_url, echo=False)

engine = _build_engine(db_url)
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


# Columns the application expects that older databases may lack (kept in sync by Alembic migration
# e5c3a9d41b27). Only SQLite (local development) is patched at start-up; PostgreSQL uses Alembic.
_EXPECTED_COLUMNS = [
    ("ai_reports", "financial_metrics", "JSON"),
    ("ai_reports", "gatekeepers", "JSON"),
    ("ai_reports", "is_audited", "BOOLEAN DEFAULT 0"),
    ("family_accounts", "pan", "VARCHAR(10)"),
    ("family_accounts", "has_ddpi", "BOOLEAN DEFAULT 0"),
    ("family_accounts", "tpin", "VARCHAR(255)"),
]


async def init_db(eng=None):
    """Called on startup - verifies the connection and makes sure missing TABLES exist.

    PostgreSQL: only `create_all` (creates missing tables, never alters anything). Column changes are
    applied by `alembic upgrade head`; a warning is logged if the schema is behind. The old code ran
    `ALTER ... BOOLEAN DEFAULT 0` (invalid on PostgreSQL) inside the same transaction as create_all, which
    aborted the transaction and silently rolled everything back.
    SQLite (local dev): create_all plus best-effort column patches, each in its own transaction.

    Does not touch the network. Initial data load is `bootstrap_data_if_empty()`.
    """
    from sqlalchemy import inspect as sa_inspect, text

    eng = eng or engine
    try:
        async with eng.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
        logger.info(f"[DB] Primary database connection OK ({eng.url.drivername})")
    except Exception as e:
        logger.warning(f"[DB Warning] Primary database unavailable: {e}")
        return

    try:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"[DB Warning] Could not create missing tables: {e}")
        return

    dialect = eng.dialect.name
    if dialect == "sqlite":
        for tbl, col, col_type in _EXPECTED_COLUMNS:
            try:
                async with eng.begin() as conn:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type}"))
            except Exception:
                pass  # column already exists
    else:
        try:
            async with eng.connect() as conn:
                def _missing(sync_conn):
                    insp = sa_inspect(sync_conn)
                    out = []
                    for tbl, col, _ in _EXPECTED_COLUMNS:
                        if insp.has_table(tbl) and col not in {c["name"] for c in insp.get_columns(tbl)}:
                            out.append(f"{tbl}.{col}")
                    return out
                missing = await conn.run_sync(_missing)
            if missing:
                logger.warning(
                    f"[DB] Schema is behind the code (missing {', '.join(missing)}). Run `alembic upgrade head`."
                )
        except Exception as e:
            logger.warning(f"[DB] Could not check schema version: {e}")
    logger.info(f"[DB] Tables verified ({eng.url.drivername})")


async def bootstrap_data_if_empty():
    """First-run convenience: load the live IPO feeds once if the ipos table is empty (uses the network)."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, func
            from app.models.ipo import Ipo
            from app.tasks.ipo_tasks import sync_ipos_pipeline
            ipo_count = (await session.execute(select(func.count(Ipo.id)))).scalar() or 0
            if ipo_count == 0:
                logger.info("[DB] Database empty. Running initial live market feed sync...")
                await sync_ipos_pipeline(session)
    except Exception as sync_err:
        logger.warning(f"[DB Warning] Initial live market sync skipped: {sync_err}")


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
