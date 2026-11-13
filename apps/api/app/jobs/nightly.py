"""Nightly analysis (02:00 IST via GitHub Actions): sync sources, then analyse offer documents.

Open IPOs first, then upcoming. A bounded number of chunks is analysed per night; every finished chunk is
saved at once, a rate limit stops the run cleanly, and the next night resumes. Nothing is ever deleted.

    python -m app.jobs.nightly
"""
import asyncio
import hashlib
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.errors import DocumentError
from app.documents.extract import chunk_pages, pdf_to_pages
from app.documents.facts import company_score_from_facts, facts_sufficient, merge_facts
from app.documents.store import analyse_pending_chunks, store_document
from app.models.analysis import AnalysisChunk, AnalysisResult, AnalysisVersion
from app.models.audit_queue import AuditRequest
from app.models.base import get_utc_now
from app.models.ipo import Ipo
from app.utils.listing_gain import listing_gain_engine
from app.utils.red_flags import detect_red_flags

logger = logging.getLogger("job.nightly")

OPEN_STATUSES = ("open", "closing_today")
MIN_CHUNKS_FOR_RESULT = 12   # read at least this many chunks (most relevant first) before an early result
BATCH = 4                    # analyse this many chunks, then check whether the core facts are already known


async def _candidates(db: AsyncSession, max_ipos: int) -> List[Ipo]:
    requested = (await db.execute(
        select(Ipo).join(AuditRequest, AuditRequest.ipo_id == Ipo.id)
        .where(AuditRequest.status == "queued").order_by(AuditRequest.created_at.asc())
    )).scalars().all()
    open_ = (await db.execute(
        select(Ipo).where(Ipo.status.in_(OPEN_STATUSES)).order_by(Ipo.issue_close_date.asc())
    )).scalars().all()
    upcoming = (await db.execute(
        select(Ipo).where(Ipo.status == "upcoming").order_by(Ipo.issue_open_date.asc())
    )).scalars().all()
    ordered, seen = [], set()
    for ipo in list(requested) + list(open_) + list(upcoming):  # guest-requested audits jump the queue
        if ipo.id not in seen:
            seen.add(ipo.id)
            ordered.append(ipo)
    return ordered[:max_ipos]


async def _latest_version(db: AsyncSession, ipo_id: str, kind: Optional[str] = None) -> Optional[AnalysisVersion]:
    q = select(AnalysisVersion).where(AnalysisVersion.ipo_id == ipo_id)
    if kind:
        q = q.where(AnalysisVersion.doc_kind == kind)
    return (await db.execute(q.order_by(AnalysisVersion.created_at.desc(), AnalysisVersion.version.desc()).limit(1))).scalar_one_or_none()


async def _pending(db: AsyncSession, version_id: str) -> int:
    return int((await db.execute(select(func.count()).select_from(AnalysisChunk).where(
        AnalysisChunk.version_id == version_id, AnalysisChunk.status == "pending"))).scalar_one())


async def _done_state(db: AsyncSession, version_id: str):
    """(merged facts so far, chunks done, chunks pending)."""
    rows = (await db.execute(select(AnalysisChunk).where(AnalysisChunk.version_id == version_id))).scalars().all()
    done = [r for r in rows if r.status == "done"]
    pending = sum(1 for r in rows if r.status == "pending")
    return merge_facts([r.facts or {} for r in done]), len(done), pending


def _enough(facts, done: int, pending: int) -> bool:
    return pending == 0 or (facts_sufficient(facts) and done >= min(MIN_CHUNKS_FOR_RESULT, done + pending))


async def _write_result(db: AsyncSession, ipo: Ipo, ver: AnalysisVersion) -> bool:
    rows = (await db.execute(select(AnalysisChunk).where(
        AnalysisChunk.version_id == ver.id, AnalysisChunk.status == "done").order_by(AnalysisChunk.chunk_index))).scalars().all()
    if not rows:
        return False
    facts = merge_facts([r.facts or {} for r in rows])
    flags = detect_red_flags(facts)
    inputs = {"gmp_percent": ipo.gmp_percent, "subscription_total": ipo.subscription_total,
              "subscription_qib": ipo.subscription_qib, "subscription_retail": ipo.subscription_retail,
              "issue_size_cr": ipo.issue_size_cr}
    res = listing_gain_engine(
        gmp_percent=ipo.gmp_percent, subscription_total=ipo.subscription_total,
        subscription_qib=ipo.subscription_qib, subscription_retail=ipo.subscription_retail,
        issue_size_cr=ipo.issue_size_cr, company_score=company_score_from_facts(facts), red_flags=flags,
    )
    last = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == ipo.id)
                             .order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc()).limit(1))).scalar_one_or_none()
    if last and last.version_id == ver.id and last.score == res["score"] and last.verdict == res["verdict"] and last.inputs == inputs:
        return True  # unchanged since last night: no duplicate row
    db.add(AnalysisResult(ipo_id=ipo.id, version_id=ver.id, score=res["score"], verdict=res["verdict"],
                          confidence=res["confidence"], components=res["components"], signals=res["signals"],
                          red_flags=flags, facts=facts, inputs=inputs))
    await db.commit()
    return True


async def _complete_requests(db: AsyncSession, ipo_id: str) -> None:
    rows = (await db.execute(select(AuditRequest).where(
        AuditRequest.ipo_id == ipo_id, AuditRequest.status == "queued"))).scalars().all()
    for r in rows:
        r.status, r.completed_at = "done", get_utc_now()
    if rows:
        await db.commit()


def _choose(ipo: Ipo):
    """(kind, url) of the document to use: the final RHP once the issue is open, else the draft."""
    if ipo.status in OPEN_STATUSES:
        order = (("RHP", ipo.rhp_url), ("DRHP", ipo.drhp_url))
    else:
        order = (("DRHP", ipo.drhp_url), ("RHP", ipo.rhp_url))
    return next(((k, u) for k, u in order if u), (None, None))


async def run_nightly(db: AsyncSession, *, extractor: Callable[[str], Awaitable[Dict[str, Any]]],
                      fetcher: Optional[Callable[[str], Awaitable[bytes]]] = None, max_chunks: int = 60,
                      max_ipos: int = 15, chunk_chars: int = 6000, chunk_overlap: int = 300,
                      model: Optional[str] = None) -> Dict[str, Any]:
    if fetcher is None:
        from app.documents.fetch import fetch_document as fetcher  # type: ignore[assignment]
    summary: Dict[str, Any] = {"analysed": 0, "skipped_no_document": 0, "document_errors": 0,
                               "incomplete": 0, "deferred": 0, "rate_limited": False, "chunks_used": 0, "details": []}
    for ipo in await _candidates(db, max_ipos):
        kind, url = _choose(ipo)
        ver = await _latest_version(db, ipo.id, kind) if kind else await _latest_version(db, ipo.id)
        try:
            if ver is None:
                if not url:
                    summary["skipped_no_document"] += 1
                    summary["details"].append(f"{ipo.symbol}: no document link yet")
                    continue
                if summary["chunks_used"] >= max_chunks:
                    summary["deferred"] += 1
                    continue
                data = await fetcher(url)
                chunks = chunk_pages(pdf_to_pages(data), max_chars=chunk_chars, overlap=chunk_overlap)
                if not chunks:
                    raise DocumentError("document has no readable text")
                ver = await store_document(db, ipo.id, kind, url, hashlib.sha256(data).hexdigest(), chunks, model=model)
        except DocumentError as exc:
            summary["document_errors"] += 1
            summary["details"].append(f"{ipo.symbol}: {exc}")
            continue

        facts, done, pending = await _done_state(db, ver.id)
        rate_limited = False
        while not _enough(facts, done, pending):
            budget = max_chunks - summary["chunks_used"]
            if budget <= 0:
                break
            step = BATCH if done >= MIN_CHUNKS_FOR_RESULT else max(1, min(BATCH, MIN_CHUNKS_FOR_RESULT - done))
            res = await analyse_pending_chunks(db, ver.id, extractor, max_chunks=min(step, budget))
            summary["chunks_used"] += res["done"] + res["failed"]
            if res.get("rate_limited"):
                rate_limited = True
                break
            if res["done"] + res["failed"] == 0:
                break
            facts, done, pending = await _done_state(db, ver.id)
        if rate_limited:
            summary["rate_limited"] = True
            summary["details"].append(f"{ipo.symbol}: provider rate limit reached; will resume next run")
            break
        if not _enough(facts, done, pending):
            summary["deferred" if summary["chunks_used"] >= max_chunks else "incomplete"] += 1
            continue
        if await _write_result(db, ipo, ver):
            summary["analysed"] += 1
            await _complete_requests(db, ipo.id)
        else:
            summary["incomplete"] += 1
    return summary


def _env_int(name: str, default: int) -> int:
    """Optional override from the environment (e.g. NIGHTLY_MAX_CHUNKS=6 for a small manual run)."""
    import os
    try:
        value = int(os.environ.get(name, ""))
        return value if value > 0 else default
    except ValueError:
        return default


async def main() -> int:
    from app.config import settings
    from app.db.database import AsyncSessionLocal
    from app.jobs.groq_llm import make_groq_extractor
    from app.sources.runner import run_sources

    if not settings.groq_api_key:
        print("GROQ_API_KEY is not set; nothing to do")
        return 2
    async with AsyncSessionLocal() as db:
        try:
            for r in await run_sources(db):
                print(f"source {r.name}: {r.status} ({r.upserted}/{r.records} stored)")
        except Exception as exc:  # documents can still be analysed from what is already stored
            await db.rollback()
            print(f"source sync failed: {type(exc).__name__}: {str(exc)[:200]}")
        extractor = make_groq_extractor(settings.groq_api_key, settings.default_ai_model)
        summary = await run_nightly(
            db, extractor=extractor, model=settings.default_ai_model,
            max_chunks=_env_int("NIGHTLY_MAX_CHUNKS", 60), max_ipos=_env_int("NIGHTLY_MAX_IPOS", 15))
    for k, v in summary.items():
        if k != "details":
            print(f"{k}: {v}")
    for line in summary["details"]:
        print(" -", line)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
