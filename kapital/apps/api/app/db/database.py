from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

Base = declarative_base()

# ── Build async engine URL ─────────────────────────────────────────────────────
db_url = settings.database_url or ""

# Ensure asyncpg driver prefix
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# ── Create engine ──────────────────────────────────────────────────────────────
# statement_cache_size=0 is required for Supabase PgBouncer/Session Pooler —
# prepared statements are not supported in pooler mode.
engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0} if "supabase" in db_url or "pooler" in db_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db():
    """Called on startup — verifies the connection is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
        print("[DB] Supabase connection OK")
    except Exception as e:
        print(f"[DB Warning] Could not connect to Postgres: {e}")


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
