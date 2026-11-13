"""Public analysis API: read precomputed listing-gain analyses and queue audits (never calls an LLM)."""
import uuid
from datetime import date, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models.analysis import AnalysisResult
from app.models.audit_queue import AuditQuota, AuditRequest
from app.models.base import get_utc_now
from app.models.ipo import Ipo

router = APIRouter(prefix="/analysis", tags=["analysis"])

FRESH_FOR = timedelta(hours=24)
APPLY_VERDICTS = ("STRONG_APPLY", "MODERATE_APPLY")


def badge_for(verdict: Optional[str]) -> Optional[str]:
    if verdict in APPLY_VERDICTS:
        return "APPLY"
    if verdict == "WATCH":
        return "WATCH"
    if verdict == "AVOID":
        return "AVOID"
    return None


async def _find_ipo(db: AsyncSession, ipo_id: str) -> Ipo:
    ipo = (await db.execute(
        select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
    )).scalars().first()
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")
    return ipo


async def _latest_result(db: AsyncSession, ipo_id: str) -> Optional[AnalysisResult]:
    return (await db.execute(
        select(AnalysisResult).where(AnalysisResult.ipo_id == ipo_id)
        .order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc()).limit(1)
    )).scalar_one_or_none()


async def _is_queued(db: AsyncSession, ipo_id: str) -> bool:
    return (await db.execute(
        select(AuditRequest.id).where(AuditRequest.ipo_id == ipo_id, AuditRequest.status == "queued").limit(1)
    )).first() is not None


def _payload(ipo: Ipo, res: Optional[AnalysisResult], queued: bool) -> Dict[str, Any]:
    if res is None:
        return {"ipo_id": ipo.id, "state": "not_analysed", "badge": None, "score": None, "verdict": None,
                "confidence": None, "signals": [], "components": {}, "red_flags": [], "facts": {},
                "as_of": None, "queued": queued}
    return {"ipo_id": ipo.id, "state": "ready", "badge": badge_for(res.verdict), "score": res.score,
            "verdict": res.verdict, "confidence": res.confidence, "signals": res.signals or [],
            "components": res.components or {}, "red_flags": res.red_flags or [], "facts": res.facts or {},
            "as_of": res.created_at.isoformat() if res.created_at else None, "queued": queued}


def _insert_ignoring_conflicts(db: AsyncSession, model, values: Dict[str, Any], conflict_cols):
    """INSERT ... ON CONFLICT DO NOTHING (PostgreSQL and SQLite). No savepoint is needed, so a refused request can
    be rolled back completely on either database."""
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return db.execute(insert(model).values(**values).on_conflict_do_nothing(index_elements=conflict_cols))


async def _take_click(db: AsyncSession, cap: int) -> bool:
    """Atomically use one of today's global clicks (one conditional UPDATE). False when the cap is reached."""
    today = date.today()
    await _insert_ignoring_conflicts(
        db, AuditQuota, {"id": str(uuid.uuid4()), "day": today, "used": 0,
                         "created_at": get_utc_now(), "updated_at": get_utc_now()}, ["day"])
    res = await db.execute(
        update(AuditQuota).where(AuditQuota.day == today, AuditQuota.used < cap).values(used=AuditQuota.used + 1)
    )
    return bool(res.rowcount)


@router.get("/{ipo_id}")
async def get_analysis(ipo_id: str, db: AsyncSession = Depends(get_db)):
    ipo = await _find_ipo(db, ipo_id)
    return _payload(ipo, await _latest_result(db, ipo.id), await _is_queued(db, ipo.id))


@router.post("/{ipo_id}/request")
async def request_audit(ipo_id: str, db: AsyncSession = Depends(get_db)):
    """Guest "Run audit": a fresh stored analysis is returned free; otherwise the IPO is queued for the
    nightly job, using one of the global daily clicks. No model is ever called here."""
    ipo = await _find_ipo(db, ipo_id)
    latest = await _latest_result(db, ipo.id)
    if latest is not None and latest.created_at and get_utc_now() - latest.created_at <= FRESH_FOR:
        out = _payload(ipo, latest, False)
        out["state"] = "cached"
        return out
    if await _is_queued(db, ipo.id):
        return {**_payload(ipo, latest, True), "state": "already_queued"}
    inserted = await _insert_ignoring_conflicts(
        db, AuditRequest, {"id": str(uuid.uuid4()), "ipo_id": ipo.id, "request_date": date.today(), "status": "queued",
                           "created_at": get_utc_now(), "updated_at": get_utc_now()}, ["ipo_id", "request_date"])
    if not inserted.rowcount:
        return {**_payload(ipo, latest, True), "state": "already_queued"}
    if not await _take_click(db, int(settings.audit_daily_cap)):
        await db.rollback()
        raise HTTPException(status_code=429, detail="Today's audit limit has been reached. Please try again tomorrow.")
    await db.commit()
    return {**_payload(ipo, latest, True), "state": "queued"}
