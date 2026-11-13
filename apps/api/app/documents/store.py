"""Append-only storage of document versions and chunk-by-chunk analysis."""
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.facts import chunk_relevance
from app.models.analysis import AnalysisChunk, AnalysisVersion

logger = logging.getLogger("documents.store")


class RateLimited(Exception):
    """The model provider asked us to slow down; stop the run and resume next time."""


async def store_document(db: AsyncSession, ipo_id: str, kind: str, url: str, sha256: str,
                         chunks: List[Dict[str, Any]], model: Optional[str] = None) -> AnalysisVersion:
    """Save a document as a new version, unless the latest stored version of that kind is identical."""
    latest = (await db.execute(
        select(AnalysisVersion).where(AnalysisVersion.ipo_id == ipo_id, AnalysisVersion.doc_kind == kind)
        .order_by(AnalysisVersion.version.desc()).limit(1)
    )).scalar_one_or_none()
    if latest is not None and latest.doc_sha256 == sha256:
        return latest
    ver = AnalysisVersion(ipo_id=ipo_id, doc_kind=kind, doc_url=url, doc_sha256=sha256,
                          version=(latest.version + 1) if latest else 1, model=model)
    db.add(ver)
    await db.flush()
    for c in chunks:
        db.add(AnalysisChunk(ipo_id=ipo_id, version_id=ver.id, chunk_index=c["index"], page_start=c["page_start"],
                             page_end=c["page_end"], text_sha256=c["sha256"], text=c["text"], status="pending"))
    await db.commit()
    return ver


async def analyse_pending_chunks(db: AsyncSession, version_id: str,
                                 llm: Callable[[str], Awaitable[Dict[str, Any]]],
                                 max_chunks: Optional[int] = None) -> Dict[str, int]:
    """Run `llm` on pending chunks (at most `max_chunks`), saving each result as soon as it is finished.

    A failing chunk is marked failed and the run continues; an unfinished run resumes with what is pending.
    """
    pending = (await db.execute(
        select(AnalysisChunk).where(AnalysisChunk.version_id == version_id, AnalysisChunk.status == "pending")
        .order_by(AnalysisChunk.chunk_index)
    )).scalars().all()
    # financial / promoter / litigation sections first; ties keep document order
    pending = sorted(pending, key=lambda c: (-chunk_relevance(c.text), c.chunk_index))
    if max_chunks is not None:
        pending = pending[:max_chunks]
    done = failed = 0
    rate_limited = False
    for chunk in pending:
        try:
            chunk.facts = await llm(chunk.text)
            chunk.status, chunk.error = "done", None
            done += 1
        except RateLimited:
            rate_limited = True  # not the chunk's fault: leave it pending and stop for tonight
            break
        except Exception as exc:
            chunk.status, chunk.error = "failed", f"{type(exc).__name__}: {exc}"[:300]
            failed += 1
            logger.warning(f"chunk {chunk.chunk_index} of {version_id} failed: {chunk.error}")
        await db.commit()  # each finished chunk is stored immediately
    remaining = (await db.execute(
        select(func.count()).select_from(AnalysisChunk).where(
            AnalysisChunk.version_id == version_id, AnalysisChunk.status == "pending")
    )).scalar_one()
    result = {"done": done, "failed": failed, "remaining": int(remaining)}
    if rate_limited:
        result["rate_limited"] = True
    return result
