from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uuid

from app.config import settings
from app.db.database import init_db
from app.routers import ipos, funds, orders, allotments, reports, websocket, health, settings as settings_router, auth
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

logger = logging.getLogger("startup")


async def _seed_accounts_from_env():
    """
    On startup: upsert all accounts from ANGEL_ACCOUNTS_JSON into PostgreSQL
    and attempt a real SmartAPI TOTP login for each.
    """
    from app.db import database
    from app.services.account_service import account_service
    from app.services.angel_service import angel_service

    env_accounts = settings.angel_accounts
    if not env_accounts:
        logger.info("No accounts in ANGEL_ACCOUNTS_JSON — skipping seed")
        return

    async with database.AsyncSessionLocal() as db:

        for env_acc in env_accounts:
            client_id = env_acc.get("client_id", "")
            name = env_acc.get("name", "Unknown")

            # 1. Upsert into PostgreSQL (survives restarts)
            try:
                acc_model = await account_service.upsert_account_from_env(db, env_acc)
                await db.commit()
                logger.info(f"[{name}] Account persisted to DB (id: {acc_model.id})")

                # Refresh in-memory cache entry
                account_service.cache_account(acc_model)
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
    try:
        await init_db()
    except Exception as e:
        logger.error(f"[Lifespan Error] Database initialization failed: {e}")

    try:
        await _seed_accounts_from_env()
    except Exception as e:
        logger.warning(f"[Lifespan Warning] Account seeding failed: {e}")

    try:
        start_scheduler()
    except Exception as e:
        logger.warning(f"[Lifespan Warning] Scheduler startup failed: {e}")

    yield

    try:
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title="Kapitl API",
    description="Kapitl Autonomous Multi-Account IPO Trading & Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS Middleware: Explicitly allow localhost origins with credentials
cors_origins_list = list(set(settings.cors_origins + [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging and rate limiting middleware
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin")
    headers = {
        "Access-Control-Allow-Credentials": "true",
    }
    if origin and (origin in cors_origins_list or origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
        headers["Access-Control-Allow-Origin"] = origin

    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
        headers=headers,
    )

# Register API Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(ipos.router, prefix="/api", tags=["ipos"])
app.include_router(funds.router, prefix="/api", tags=["funds"])
app.include_router(orders.router, prefix="/api", tags=["orders"])
app.include_router(allotments.router, prefix="/api", tags=["allotments"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(settings_router.router, prefix="/api", tags=["settings"])
app.include_router(websocket.router, tags=["websocket"])
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
