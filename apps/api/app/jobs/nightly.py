"""Nightly analysis (02:00 IST via GitHub Actions): sync sources, then analyse offer documents.

Open IPOs first, then upcoming. A bounded number of chunks is analysed per night; every finished chunk is
saved at once, a rate limit stops the run cleanly, and the next night resumes. Nothing is ever deleted.

    python -m app.jobs.nightly
"""
import asyncio
from datetime import date
import hashlib
import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.errors import DocumentError
from app.documents.extract import chunk_pages, pdf_to_pages
from app.documents.facts import facts_sufficient, merge_facts
from app.documents.store import analyse_pending_chunks, store_document
from app.services.ipo_service import _apply_document_url, refresh_all_scores, refresh_statuses, refresh_stored_score
from app.services.rating import rate
from app.models.analysis import AnalysisChunk, AnalysisResult, AnalysisVersion
from app.models.audit_queue import AuditRequest
from app.models.base import get_utc_now
from app.models.ipo import Ipo

logger = logging.getLogger("job.nightly")

OPEN_STATUSES = ("open", "closing_today")
MIN_CHUNKS_FOR_RESULT = 12   # read at least this many chunks (most relevant first) before an early result
MAX_DISCOVERY = 10           # document-link look-ups per night
BATCH = 4                    # analyse this many chunks, then check whether the core facts are already known


async def _candidates(db: AsyncSession, limit: int = 80) -> List[Ipo]:
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
    # upcoming IPOs rotate daily, so the same few with no document do not take every night's look-ups
    day = date.today().isoformat()
    upcoming = sorted(upcoming, key=lambda i: hashlib.md5(f"{i.slug}{day}".encode()).hexdigest())
    ordered, seen = [], set()
    for ipo in list(requested) + list(open_) + list(upcoming):  # guest-requested audits jump the queue
        if ipo.id not in seen:
            seen.add(ipo.id)
            ordered.append(ipo)
    return ordered[:limit]


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


async def _write_result(db: AsyncSession, ipo: Ipo, ver: AnalysisVersion, facts: Optional[Dict[str, Any]] = None) -> bool:
    if facts is None:
        rows = (await db.execute(select(AnalysisChunk).where(
            AnalysisChunk.version_id == ver.id, AnalysisChunk.status == "done").order_by(AnalysisChunk.chunk_index))).scalars().all()
        if not rows:
            return False
        facts = merge_facts([r.facts or {} for r in rows])
    res = rate(ipo, facts)           # the one rating function every endpoint uses
    flags = res["red_flags"]
    facts = res["facts"]
    inputs = {"gmp_percent": ipo.gmp_percent, "subscription_total": ipo.subscription_total,
              "subscription_qib": ipo.subscription_qib, "subscription_retail": ipo.subscription_retail,
              "issue_size_cr": ipo.issue_size_cr}
    last = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == ipo.id)
                             .order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc()).limit(1))).scalar_one_or_none()
    if last and last.version_id == ver.id and last.score == res["score"] and last.verdict == res["verdict"] and last.inputs == inputs:
        return True  # unchanged since last night: no duplicate row
    db.add(AnalysisResult(ipo_id=ipo.id, version_id=ver.id, score=res["score"], verdict=res["verdict"],
                          confidence=res["confidence"], components=res["components"], signals=res["signals"],
                          red_flags=flags, facts=facts, inputs=inputs))
    await db.commit()
    await refresh_stored_score(db, ipo)   # the stored score follows the new analysis
    await db.commit()
    return True


async def _summary_fallback(db: AsyncSession, ipo: Ipo, summary_finder) -> bool:
    """No readable offer document: score from the structured company financials of Groww's IPO page instead.
    The facts carry `facts_basis = groww_summary`, so the score is capped and the reader is told what it rests on."""
    if summary_finder is None:
        return False
    latest = (await db.execute(select(AnalysisResult.facts).where(AnalysisResult.ipo_id == ipo.id)
                               .order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc()).limit(1))).first()
    if latest is not None and latest[0] and "facts_basis" not in latest[0]:
        return False        # a result from the real offer document exists: a summary must never replace it
    try:
        found = await summary_finder(ipo)
    except Exception as exc:   # a broken fallback must never stop the run
        logger.warning(f"summary fallback for {ipo.symbol} failed: {type(exc).__name__}: {exc}")
        return False
    if not found or not found.get("facts"):
        return False
    facts = dict(found["facts"], facts_basis="groww_summary")
    sha = hashlib.sha256(json.dumps(facts, sort_keys=True).encode("utf-8")).hexdigest()
    ver = await store_document(db, ipo.id, "SUMMARY", found["url"], sha, [], model=None)
    return await _write_result(db, ipo, ver, facts)


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
                      model: Optional[str] = None, max_tokens: Optional[int] = None,
                      link_finder: Optional[Callable[[Ipo], Awaitable[Optional[str]]]] = None,
                      summary_finder: Optional[Callable[[Ipo], Awaitable[Optional[Dict[str, Any]]]]] = None) -> Dict[str, Any]:
    if fetcher is None:
        from app.documents.fetch import fetch_document

        async def fetcher(url):  # issuer-hosted PDFs are allowed, behind the public-address checks
            return await fetch_document(url, public_ok=True)
    discovered = 0

    def out_of_tokens() -> bool:
        return max_tokens is not None and getattr(extractor, "tokens_used", 0) >= max_tokens
    summary_statuses = await refresh_statuses(db)  # stale 'open'/'upcoming' rows must not be analysed first
    scores_refreshed = await refresh_all_scores(db)  # rules or stored facts may have changed since the last run
    summary: Dict[str, Any] = {"analysed": 0, "skipped_no_document": 0, "document_errors": 0,
                               "incomplete": 0, "deferred": 0, "rate_limited": False, "token_budget_reached": False, "tokens_used": 0, "chunks_used": 0,
                               "summary_fallbacks": 0, "details": []}
    summary["statuses_fixed"] = summary_statuses
    summary["scores_refreshed"] = scores_refreshed
    processed = 0      # IPOs actually worked on; those with nothing to read do not use up the per-night limit
    for ipo in await _candidates(db):
        if processed >= max_ipos:
            break
        kind, url = _choose(ipo)
        if url is None and link_finder is not None and discovered < MAX_DISCOVERY:
            discovered += 1
            found = await link_finder(ipo)
            if found:
                if "drhp" in found.lower():       # the link is the draft, whatever the issue's status
                    if not ipo.drhp_url:
                        ipo.drhp_url = found
                else:
                    _apply_document_url(ipo, {"document_url": found}, ipo.status)
                await db.commit()
                kind, url = _choose(ipo)
        ver = await _latest_version(db, ipo.id, kind) if kind else await _latest_version(db, ipo.id)
        try:
            if ver is None:
                if not url:
                    if await _summary_fallback(db, ipo, summary_finder):
                        processed += 1
                        summary["summary_fallbacks"] += 1
                        summary["analysed"] += 1
                        summary["details"].append(f"{ipo.symbol}: no offer document found; scored from Groww summary financials")
                        await _complete_requests(db, ipo.id)
                        continue
                    summary["skipped_no_document"] += 1
                    summary["details"].append(f"{ipo.symbol}: no document link yet")
                    continue
                if summary["chunks_used"] >= max_chunks:
                    summary["deferred"] += 1
                    if await _summary_fallback(db, ipo, summary_finder):   # provisional score until the document is read
                        summary["summary_fallbacks"] += 1
                    continue
                data = await fetcher(url)
                chunks = chunk_pages(pdf_to_pages(data), max_chars=chunk_chars, overlap=chunk_overlap)
                if not chunks:
                    raise DocumentError("document has no readable text")
                ver = await store_document(db, ipo.id, kind, url, hashlib.sha256(data).hexdigest(), chunks, model=model)
        except DocumentError as exc:
            summary["document_errors"] += 1
            summary["details"].append(f"{ipo.symbol}: {exc}")
            processed += 1
            if await _summary_fallback(db, ipo, summary_finder):   # the document could not be read: use the summary
                summary["summary_fallbacks"] += 1
                summary["analysed"] += 1
                await _complete_requests(db, ipo.id)
            continue

        processed += 1
        facts, done, pending = await _done_state(db, ver.id)
        rate_limited = False
        while not _enough(facts, done, pending):
            budget = max_chunks - summary["chunks_used"]
            if budget <= 0:
                break
            if out_of_tokens():
                summary["token_budget_reached"] = True
                break
            step = BATCH if done >= MIN_CHUNKS_FOR_RESULT else max(1, min(BATCH, MIN_CHUNKS_FOR_RESULT - done))
            res = await analyse_pending_chunks(db, ver.id, extractor, max_chunks=min(step, budget), stop_check=out_of_tokens)
            summary["chunks_used"] += res["done"] + res["failed"]
            if res.get("stopped"):
                summary["token_budget_reached"] = True
                break
            if res.get("rate_limited"):
                rate_limited = True
                break
            if res["done"] + res["failed"] == 0:
                break
            facts, done, pending = await _done_state(db, ver.id)
        if summary["token_budget_reached"]:
            summary["details"].append(f"{ipo.symbol}: token budget used up; will resume next run")
            break
        if rate_limited:
            summary["rate_limited"] = True
            summary["details"].append(f"{ipo.symbol}: provider rate limit reached; will resume next run")
            break
        if not _enough(facts, done, pending):
            summary["deferred" if summary["chunks_used"] >= max_chunks else "incomplete"] += 1
            if await _summary_fallback(db, ipo, summary_finder):       # provisional score until the document is read
                summary["summary_fallbacks"] += 1
            continue
        if await _write_result(db, ipo, ver):
            summary["analysed"] += 1
            await _complete_requests(db, ipo.id)
        else:
            summary["incomplete"] += 1
    summary["tokens_used"] = int(getattr(extractor, "tokens_used", 0) or 0)
    return summary


def _ipowatch_slugs(ipo) -> List[str]:
    """IPO Watch page slugs to try: the stored one if it already looks like theirs, else ones built from the name."""
    import re
    out: List[str] = []
    slug = (ipo.slug or "")
    if slug.endswith("-ipo-details"):
        out.append(slug)
    base = re.sub(r"[^a-z0-9]+", "-", (ipo.name or "").lower()).strip("-")
    if base:
        for variant in (re.sub(r"-(limited|ltd)$", "", base), base):
            cand = f"{variant}-ipo-details"
            if cand not in out:
                out.append(cand)
    return out


async def _summary_finder(ipo: Ipo) -> Optional[Dict[str, Any]]:
    from app.sources import groww
    return await groww.fetch_summary(ipo.slug)


async def _link_finder(ipo: Ipo) -> Optional[str]:
    """Look for the offer-document link on the IPO's IPO Watch page (NSE filing), then on its Groww page."""
    from app.sources import groww, ipowatch
    for slug in _ipowatch_slugs(ipo):
        found = await ipowatch.fetch_document_link(slug)
        if found:
            return found
    return await groww.fetch_document_link(ipo.slug)


def alerts_for(reports) -> List[str]:
    """One line per source that failed or warned. Failures make the job exit non-zero, so the GitHub Actions run
    shows as failed and GitHub's own notification reaches the repository owner."""
    out = []
    for r in reports:
        if r.status == "failed":
            out.append(f"ALERT source {r.name} failed: {r.error or 'no detail'}")
        elif r.status == "warning":
            out.append(f"WARNING source {r.name}: {r.error or 'no detail'}")
    return out


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
    alerts: List[str] = []
    async with AsyncSessionLocal() as db:
        try:
            reports = await run_sources(db)
            for r in reports:
                print(f"source {r.name}: {r.status} ({r.upserted}/{r.records} stored)")
            alerts = alerts_for(reports)
        except Exception as exc:  # documents can still be analysed from what is already stored
            await db.rollback()
            alerts = [f"ALERT source sync crashed: {type(exc).__name__}: {str(exc)[:200]}"]
        extractor = make_groq_extractor(settings.groq_api_key, settings.default_ai_model)
        summary = await run_nightly(
            db, extractor=extractor, model=settings.default_ai_model, link_finder=_link_finder, summary_finder=_summary_finder,
            max_chunks=_env_int("NIGHTLY_MAX_CHUNKS", 60), max_ipos=_env_int("NIGHTLY_MAX_IPOS", 15),
            max_tokens=_env_int("NIGHTLY_MAX_TOKENS", 150000))
    for k, v in summary.items():
        if k != "details":
            print(f"{k}: {v}")
    for line in summary["details"]:
        print(" -", line)
    for line in alerts:
        print(line)
    return 1 if any(a.startswith("ALERT") for a in alerts) else 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
