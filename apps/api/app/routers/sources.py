from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.source_health import SourceHealth

router = APIRouter(prefix="/sources", tags=["sources"])


def _status(row: SourceHealth) -> str:
    if row.last_attempt_at is None:
        return "never_run"
    if (row.consecutive_failures or 0) > 0:
        return "failing"
    if row.last_error and row.last_error.startswith("WARNING"):
        return "warning"
    return "ok"


@router.get("/health")
async def source_health(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    """Health of every data source: last success, last error, consecutive failures, request budget use."""
    rows = (await db.execute(select(SourceHealth).order_by(SourceHealth.source))).scalars().all()
    return [
        {
            "source": r.source,
            "status": _status(r),
            "last_attempt_at": r.last_attempt_at.isoformat() if r.last_attempt_at else None,
            "last_success_at": r.last_success_at.isoformat() if r.last_success_at else None,
            "last_error": r.last_error,
            "consecutive_failures": r.consecutive_failures or 0,
            "last_record_count": r.last_record_count or 0,
            "requests_today": r.requests_today or 0,
            "budget_date": r.budget_date.isoformat() if r.budget_date else None,
        }
        for r in rows
    ]
