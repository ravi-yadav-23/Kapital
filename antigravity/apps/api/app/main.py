from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uuid

from app.config import settings
from app.db.database import init_db
from app.routers import ipos, funds, orders, allotments, reports, websocket, health, settings as settings_router

logger = logging.getLogger("startup")


async def _seed_accounts_from_env():
    """
    On startup: upsert all accounts from ANGEL_ACCOUNTS_JSON into PostgreSQL
    and attempt a real SmartAPI TOTP login for each.
    """
    from app.db.database import AsyncSessionLocal
    from app.services.account_service import account_service, MOCK_ACCOUNTS_STORE, _model_to_dict
    from app.services.angel_service import angel_service

    env_accounts = settings.angel_accounts
    if not env_accounts:
        logger.info("No accounts in ANGEL_ACCOUNTS_JSON — skipping seed")
        return

    async with AsyncSessionLocal() as db:
        for env_acc in env_accounts:
            client_id = env_acc.get("client_id", "")
            name = env_acc.get("name", "Unknown")

            # 1. Upsert into PostgreSQL (survives restarts)
            try:
                acc_model = await account_service.upsert_account_from_env(db, env_acc)
                await db.commit()
                logger.info(f"[{name}] Account persisted to DB (id: {acc_model.id})")

                # Refresh in-memory cache entry
                acc_dict = _model_to_dict(acc_model)
                if not any(a.get("angel_client_id") == client_id for a in MOCK_ACCOUNTS_STORE):
                    MOCK_ACCOUNTS_STORE.append(acc_dict)
            except Exception as e:
                await db.rollback()
                logger.error(f"[{name}] DB upsert failed: {e}")
                continue

            # 2. Attempt real SmartAPI login to refresh JWT token
            try:
                result = await angel_service.login_account(
                    client_id=client_id,
                    api_key=env_acc.get("api_key", ""),
                    pin=env_acc.get("pin", ""),
                    totp_secret=env_acc.get("totp_secret", ""),
                )
                logger.info(f"[{name}] Angel One LIVE login OK — JWT refreshed")

                # 3. Sync live RMS balances directly into PostgreSQL
                try:
                    await account_service.sync_live_balance(db, client_id)
                    await db.commit()
                    logger.info(f"[{name}] Live RMS balances synced to PostgreSQL")
                except Exception as rms_err:
                    logger.warning(f"[{name}] RMS balance sync non-fatal warning: {rms_err}")
            except Exception as e:
                logger.warning(f"[{name}] Angel One login failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.tasks.scheduler import start_scheduler, stop_scheduler
    await init_db()
    await _seed_accounts_from_env()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Antigravity API",
    description="Personal Autonomous IPO Trading & Multi-Account Allocation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.environment == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(ipos.router, prefix="/api", tags=["ipos"])
app.include_router(funds.router, prefix="/api", tags=["funds"])
app.include_router(orders.router, prefix="/api", tags=["orders"])
app.include_router(allotments.router, prefix="/api", tags=["allotments"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(settings_router.router, prefix="/api", tags=["settings"])
app.include_router(websocket.router, tags=["websocket"])
