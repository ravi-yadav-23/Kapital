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

def _build_engine(url: str):
    if "supabase" in url or "pooler" in url:
        return create_async_engine(
            url,
            echo=False,
            pool_pre_ping=True,
            connect_args={"statement_cache_size": 0, "command_timeout": 3.0, "timeout": 3.0},
        )
    elif url.startswith("sqlite"):
        return create_async_engine(url, echo=False)
    else:
        return create_async_engine(url, echo=False, pool_pre_ping=True)

engine = _build_engine(db_url)
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db():
    """Called on startup — verifies DB connection and ensures tables exist. Falls back to local SQLite if remote PostgreSQL is unreachable."""
    global engine, AsyncSessionLocal
    try:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
        print("[DB] Primary database connection OK")
    except Exception as e:
        print(f"[DB Notice] Remote database unavailable ({e}). Automatically activating resilient local SQLite database.")
        sqlite_url = "sqlite+aiosqlite:///./kapitl_local.db"
        engine = create_async_engine(sqlite_url, echo=False)
        AsyncSessionLocal = async_sessionmaker(
            engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print(f"[DB] All tables verified and ready ({engine.url.drivername})")
    except Exception as e:
        print(f"[DB Warning] Could not sync metadata tables: {e}")


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
