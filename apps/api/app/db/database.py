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
                connect_args={"statement_cache_size": 0, "command_timeout": 3.0, "timeout": 3.0},
            )
        elif url.startswith("sqlite"):
            if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
                # Serverless working directory is read-only; use /tmp
                url = "sqlite+aiosqlite:////tmp/kapitl_local.db"
            return create_async_engine(url, echo=False)
        else:
            return create_async_engine(url, echo=False, pool_pre_ping=True)
    except Exception as e:
        logger.error(f"[DB Error] Failed to create engine for {url}: {e}. Falling back to SQLite on /tmp")
        fallback_url = "sqlite+aiosqlite:////tmp/kapitl_local.db"
        return create_async_engine(fallback_url, echo=False)

engine = _build_engine(db_url)
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db():
    """Called on startup — verifies DB connection and ensures tables exist."""
    try:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
        logger.info(f"[DB] Primary database connection OK ({engine.url.drivername})")
    except Exception as e:
        logger.warning(f"[DB Warning] Primary database unavailable: {e}")
        return

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"[DB] All tables verified and ready ({engine.url.drivername})")

        try:
            async with AsyncSessionLocal() as session:
                from app.db.seed_data import seed_initial_ipos_and_reports
                await seed_initial_ipos_and_reports(session)
        except Exception as seed_err:
            logger.warning(f"[DB Warning] Could not seed initial IPOs/reports: {seed_err}")
    except Exception as e:
        logger.warning(f"[DB Warning] Could not sync metadata tables: {e}")


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
