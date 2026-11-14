"""The ONE place an IPO's score is computed: the Listing-Gain Engine on live market data plus whatever the
nightly document analysis has found (company quality, red flags).

Every endpoint, the optimizer and the badges go through `rate()`, so the same IPO has the same score and verdict
everywhere. With no document analysis the score uses market data only (and says so through its confidence);
with no data at all the score is None ("No score yet").
"""
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.facts import company_score_from_facts, looks_like_lender
from app.models.analysis import AnalysisResult
from app.utils.listing_gain import listing_gain_engine
from app.utils.red_flags import detect_red_flags


GROWW_SUMMARY = "groww_summary"


def _get(ipo: Any, key: str):
    return ipo.get(key) if isinstance(ipo, dict) else getattr(ipo, key, None)


def rate(ipo: Any, facts: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Engine result for an IPO (ORM row or dict). `facts` default to the ones attached by `attach_facts`."""
    if facts is None:
        facts = _get(ipo, "analysis_facts")
    facts = dict(facts or {})
    if facts and looks_like_lender(_get(ipo, "name") or ""):
        facts["is_lender"] = True       # back-up for the model's own flag
    limited = facts.get("facts_basis") == GROWW_SUMMARY      # facts from a summary, not from the offer document
    flags = detect_red_flags(facts) if facts else []
    company = company_score_from_facts(facts, limited=limited) if facts else None
    res = listing_gain_engine(
        gmp_percent=_get(ipo, "gmp_percent"),
        subscription_total=_get(ipo, "subscription_total"),
        subscription_qib=_get(ipo, "subscription_qib"),
        subscription_retail=_get(ipo, "subscription_retail"),
        issue_size_cr=_get(ipo, "issue_size_cr"),
        company_score=company,
        red_flags=flags,
    )
    res["red_flags"] = flags
    res["facts"] = facts
    res["facts_basis"] = GROWW_SUMMARY if limited else ("offer_document" if facts else None)
    res["documents_analysed"] = bool(facts) and not limited
    return res


async def latest_facts_map(db: AsyncSession, ipo_ids: Optional[Iterable[str]] = None) -> Dict[str, Dict[str, Any]]:
    """Facts from the newest stored analysis result of each IPO (one query)."""
    q = select(AnalysisResult.ipo_id, AnalysisResult.facts).order_by(
        AnalysisResult.created_at.desc(), AnalysisResult.id.desc())
    if ipo_ids is not None:
        ids = list(ipo_ids)
        if not ids:
            return {}
        q = q.where(AnalysisResult.ipo_id.in_(ids))
    out: Dict[str, Dict[str, Any]] = {}
    for ipo_id, facts in (await db.execute(q)).all():
        if ipo_id not in out and facts:
            out[ipo_id] = facts
    return out


async def attach_facts(db: AsyncSession, ipos: Iterable[Any]) -> None:
    """Put each IPO's stored document facts on the object (as `analysis_facts`) so `rate()` can use them."""
    ipos = list(ipos)
    facts = await latest_facts_map(db, [i.id for i in ipos])
    for ipo in ipos:
        ipo.analysis_facts = facts.get(ipo.id)
