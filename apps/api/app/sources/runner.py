"""Runs data sources: isolates failures, stores records, tracks health and daily request budgets."""
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.source_health import SourceHealth
from app.sources.base import Source, SourceResult

logger = logging.getLogger("source.runner")


@dataclass
class SourceReport:
    name: str
    status: str                    # ok | warning | failed | disabled | skipped_budget
    records: int = 0
    upserted: int = 0
    record_errors: int = 0
    error: Optional[str] = None


def default_sources() -> List[Source]:
    """Order matters: later sources enrich/override earlier ones in the merge."""
    from app.sources.ipoalerts import IpoAlertsSource
    from app.sources.groww import GrowwSource
    from app.sources.ipowatch import IpoWatchSource
    return [GrowwSource(), IpoAlertsSource(), IpoWatchSource()]


GMP_PLAUSIBLE_PERCENT = (-50.0, 300.0)


def sanitize_record(rec: dict) -> tuple:
    """Validate one record. Raises ValueError if unusable; drops implausible values and says so.

    Returns (clean_record, [notes]).
    """
    if not (rec.get("symbol") or "").strip() or not (rec.get("name") or "").strip():
        raise ValueError("record without symbol/name")
    clean = dict(rec)
    notes = []
    gmp = clean.get("gmp_percent")
    if gmp is not None and not (GMP_PLAUSIBLE_PERCENT[0] <= float(gmp) <= GMP_PLAUSIBLE_PERCENT[1]):
        notes.append(f"{clean['symbol']}: implausible GMP {float(gmp):.0f}% dropped")
        clean.pop("gmp_percent", None)
        clean.pop("gmp_rupees", None)
    for key in ("subscription_retail", "subscription_shni", "subscription_bhni", "subscription_qib", "subscription_total"):
        if clean.get(key) is not None and float(clean[key]) < 0:
            notes.append(f"{clean['symbol']}: implausible {key} dropped")
            clean.pop(key, None)
    return clean, notes


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _health_row(db: AsyncSession, name: str) -> SourceHealth:
    row = (await db.execute(select(SourceHealth).where(SourceHealth.source == name))).scalar_one_or_none()
    if row is None:
        row = SourceHealth(source=name, consecutive_failures=0, last_record_count=0, requests_today=0)
        db.add(row)
        await db.flush()
    return row


def _roll_budget_day(row: SourceHealth) -> None:
    if row.budget_date != date.today():
        row.budget_date = date.today()
        row.requests_today = 0


async def remaining_budget(db: AsyncSession, source: Source) -> Optional[int]:
    """Requests this source may still make today (None = unlimited)."""
    if source.daily_request_budget is None:
        return None
    row = await _health_row(db, source.name)
    _roll_budget_day(row)
    return max(0, source.daily_request_budget - (row.requests_today or 0))


async def add_usage(db: AsyncSession, source: Source, used: int) -> None:
    row = await _health_row(db, source.name)
    _roll_budget_day(row)
    row.requests_today = (row.requests_today or 0) + used
    await db.flush()


async def run_sources(db: AsyncSession, sources: Optional[List[Source]] = None) -> List[SourceReport]:
    """Fetch every enabled source and upsert its records. One failing source or record never stops the rest."""
    from app.services.ipo_service import ipo_service

    reports: List[SourceReport] = []
    for src in (sources if sources is not None else default_sources()):
        if not src.enabled():
            reports.append(SourceReport(src.name, "disabled"))
            continue

        health = await _health_row(db, src.name)
        _roll_budget_day(health)
        allowed: Optional[int] = None
        if src.daily_request_budget is not None:
            allowed = src.daily_request_budget - (health.requests_today or 0)
            if allowed <= 0:
                health.last_error = "WARNING: daily request budget used up; skipped"
                await db.commit()
                reports.append(SourceReport(src.name, "skipped_budget", error=health.last_error))
                continue

        health.last_attempt_at = _now()
        try:
            result = await src.fetch(requests_allowed=allowed)
        except Exception as exc:  # a plug-in bug or an unexpected site change must not break the sync
            logger.exception(f"[{src.name}] fetch crashed")
            result = SourceResult(error=f"{type(exc).__name__}: {exc}")
        health.requests_today = (health.requests_today or 0) + (result.requests_used or 0)

        upserted = record_errors = 0
        notes: List[str] = []
        for rec in result.records:
            try:
                clean, rec_notes = sanitize_record(rec)
                notes.extend(rec_notes)
                async with db.begin_nested():
                    await ipo_service.upsert_ipo(db, clean)
                upserted += 1
            except Exception as exc:
                record_errors += 1
                logger.warning(f"[{src.name}] could not store {rec.get('symbol')}: {exc}")

        if result.error:
            status, message = "failed", result.error
        elif result.records and upserted == 0:
            status, message = "failed", f"none of {len(result.records)} records could be stored"
        elif not result.records and not src.empty_is_normal:
            status, message = "warning", "WARNING: 0 records parsed (layout change or blocked?)"
        else:
            status, message = "ok", None
        if status == "ok" and (result.warnings or notes):
            message = "WARNING: " + "; ".join(list(result.warnings) + notes)[:450]

        if status == "failed":
            health.consecutive_failures = (health.consecutive_failures or 0) + 1
        else:
            health.consecutive_failures = 0
            health.last_success_at = _now()
        health.last_error = message[:500] if message else None
        health.last_record_count = upserted
        await db.commit()
        reports.append(SourceReport(src.name, status, len(result.records), upserted, record_errors, message))
        logger.info(f"[{src.name}] {status}: {upserted}/{len(result.records)} stored"
                    + (f" - {message}" if message else ""))
    return reports
