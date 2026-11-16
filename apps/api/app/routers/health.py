from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from typing import Dict, Any

from app.db.database import AsyncSessionLocal
from app.db.redis import get_redis_pool

router = APIRouter()


@router.get("")
async def health_check():
    """
    Comprehensive system health check.
    Pings primary database and Redis cache.
    Returns 200 OK when operational, 503 SERVICE UNAVAILABLE if core dependencies fail.
    """
    db_status = "healthy"
    redis_status = "unconfigured"
    is_healthy = True

    # 1. Database check (and when the IPO sources last refreshed successfully: public, no personal data)
    data_updated_at = None
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            try:
                from sqlalchemy import func, select
                from app.models.source_health import SourceHealth
                latest = (await db.execute(select(func.max(SourceHealth.last_success_at)))).scalar()
                data_updated_at = latest.isoformat() if latest else None
            except Exception:
                data_updated_at = None
    except Exception as e:
        db_status = f"unhealthy: {e}"
        is_healthy = False

    # 2. Redis check (non-fatal if unconfigured, but checked if present)
    try:
        redis_client = await get_redis_pool()
        if redis_client:
            await redis_client.ping()
            redis_status = "healthy"
        else:
            redis_status = "unavailable"
    except Exception as e:
        redis_status = f"unhealthy: {e}"

    payload: Dict[str, Any] = {
        "status": "ok" if is_healthy else "degraded",
        "service": "Kapitl API",
        "version": "1.0.0",
        "database": db_status,
        "redis": redis_status,
        "data_updated_at": data_updated_at,
    }

    if not is_healthy:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)

    return payload
