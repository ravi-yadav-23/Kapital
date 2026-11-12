"""Append-only score history: record a row only when the score really changes."""
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.score_history import ScoreHistory


async def record_score(
    db: AsyncSession,
    ipo_id: str,
    component: str,
    value: Optional[int],
    recommendation: Optional[str],
    reason: str,
    inputs: Optional[Dict[str, Any]] = None,
) -> bool:
    """Insert a history row if `value` differs from the latest one. Returns True if a row was added.

    A first-ever value of None ("no score yet") is not recorded; a later change back to None is.
    """
    res = await db.execute(
        select(ScoreHistory)
        .where(ScoreHistory.ipo_id == ipo_id, ScoreHistory.component == component)
        .order_by(ScoreHistory.created_at.desc(), ScoreHistory.id.desc())
        .limit(1)
    )
    last = res.scalar_one_or_none()
    if last is None and value is None:
        return False
    if last is not None and last.value == value:
        return False
    db.add(ScoreHistory(
        ipo_id=ipo_id, component=component, value=value,
        recommendation=recommendation, reason=(reason or "")[:500], inputs=inputs or {},
    ))
    await db.flush()
    return True
