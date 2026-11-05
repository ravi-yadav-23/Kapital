from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.models.ipo import Ipo
from app.models.report import AiReport
from app.schemas.report import AiReportResponse
from app.services.report_service import report_service
from app.services.pnl_service import pnl_service
from app.middleware.auth import get_current_user_optional
from app.db.seed_data import seed_initial_ipos_and_reports
from app.utils.date_utils import compute_ipo_status

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("", response_model=List[AiReportResponse])
async def list_ai_reports(db: AsyncSession = Depends(get_db)):
    """
    List all generated AI Due Diligence reports with 6-dimension scores.
    Includes all active IPOs from live market feeds.
    If an active IPO does not yet have an AI report, it generates it once and persists it to DB.
    """
    # 1. Fetch all candidate IPOs with their optional AI reports
    stmt = (
        select(Ipo, AiReport)
        .outerjoin(AiReport, Ipo.id == AiReport.ipo_id)
        .order_by(Ipo.score.desc().nullslast())
    )
    res = await db.execute(stmt)
    rows = res.all()

    # If database has no IPOs, trigger live market sync
    if not rows:
        from app.tasks.ipo_tasks import sync_ipos_pipeline
        await sync_ipos_pipeline(db)
        res = await db.execute(stmt)
        rows = res.all()

    reports = []
    for ipo_row, report_row in rows:
        if report_row:
            reports.append(report_service.format_report_response(report_row, ipo_row))
        else:
            reports.append(report_service.build_fallback_report_response(ipo_row))

    return reports


@router.get("/{ipo_id}", response_model=AiReportResponse)
async def get_ai_report(
    ipo_id: str,
    symbol: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get full AI Due Diligence & Red Flag audit report for a specific IPO.
    Fetches the single-run cached report from the database if available.
    """
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()

    if not ipo and symbol:
        ipo = (await db.execute(select(Ipo).where(Ipo.symbol == symbol.upper()))).scalar_one_or_none()

    if not ipo and slug:
        ipo = (await db.execute(select(Ipo).where(Ipo.slug == slug.lower()))).scalar_one_or_none()

    if not ipo and name:
        from app.services.ipo_service import normalize_entity_name
        stmt_name = select(Ipo).where(
            (Ipo.name.ilike(f"%{name}%")) | (func.lower(Ipo.name) == name.lower())
        )
        ipo = (await db.execute(stmt_name)).scalars().first()

    if not ipo:
        try:
            from app.models.ipo import IpoAlias
            from app.services.ipo_service import normalize_entity_name
            stmt_alias = (
                select(Ipo)
                .join(IpoAlias, Ipo.id == IpoAlias.ipo_id)
                .where((IpoAlias.alias.ilike(f"%{ipo_id}%")) | (IpoAlias.normalized_alias == normalize_entity_name(ipo_id)))
            )
            res_alias = await db.execute(stmt_alias)
            ipo = res_alias.scalars().first()
        except Exception:
            pass

    if not ipo:
        # Check if benchmark IPOs need to be seeded
        await seed_initial_ipos_and_reports(db)
        res = await db.execute(stmt)
        ipo = res.scalar_one_or_none()

    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")

    stmt_rep = select(AiReport).where(AiReport.ipo_id == ipo.id)
    res_rep = await db.execute(stmt_rep)
    existing = res_rep.scalar_one_or_none()
    if existing:
        return report_service.format_report_response(existing, ipo)

    return report_service.build_fallback_report_response(ipo)


@router.post("/{ipo_id}/generate", response_model=AiReportResponse)
async def trigger_ai_analysis(
    ipo_id: str,
    force: bool = Query(False, description="Force re-run even if report exists (admin only)"),
    symbol: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user_optional),
):
    """
    Trigger or view AI due diligence analysis for an IPO.
    - If a report already exists in the DB and force=False, returns cached report at 0 LLM cost.
    - Uses a Redis distributed lock to prevent concurrent redundant generation for the same issue.
    - Only authenticated administrators can force a fresh LLM re-run with force=True.
    """
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()

    if not ipo and symbol:
        ipo = (await db.execute(select(Ipo).where(Ipo.symbol == symbol.upper()))).scalar_one_or_none()

    if not ipo and slug:
        ipo = (await db.execute(select(Ipo).where(Ipo.slug == slug.lower()))).scalar_one_or_none()

    if not ipo and name:
        from app.services.ipo_service import normalize_entity_name
        stmt_name = select(Ipo).where(
            (Ipo.name.ilike(f"%{name}%")) | (func.lower(Ipo.name) == name.lower())
        )
        ipo = (await db.execute(stmt_name)).scalars().first()

    if not ipo:
        try:
            from app.models.ipo import IpoAlias
            from app.services.ipo_service import normalize_entity_name
            stmt_alias = (
                select(Ipo)
                .join(IpoAlias, Ipo.id == IpoAlias.ipo_id)
                .where((IpoAlias.alias.ilike(f"%{ipo_id}%")) | (IpoAlias.normalized_alias == normalize_entity_name(ipo_id)))
            )
            res_alias = await db.execute(stmt_alias)
            ipo = res_alias.scalars().first()
        except Exception:
            pass

    if not ipo:
        await seed_initial_ipos_and_reports(db)
        res = await db.execute(stmt)
        ipo = res.scalar_one_or_none()

    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")

    # Check if report already exists in database
    stmt_rep = select(AiReport).where(AiReport.ipo_id == ipo.id)
    res_rep = await db.execute(stmt_rep)
    existing = res_rep.scalar_one_or_none()

    # 1. Return cached report if present and force is False
    if existing and not force:
        return report_service.format_report_response(existing, ipo)

    # 2. If forcing refresh, require Administrator privileges
    if force and (not user or user.get("role") != "ADMIN" or user.get("is_guest")):
        raise HTTPException(
            status_code=403,
            detail="Force re-running AI audit requires Administrator privileges. Viewing cached report.",
        )

    # 3. Distributed Redis lock per IPO to serialize concurrent audits
    import uuid
    from app.db.redis import get_redis_pool

    redis = await get_redis_pool()
    lock_key = f"audit_lock:{ipo.id}"
    lock_token = str(uuid.uuid4())

    if redis:
        acquired = await redis.set(lock_key, lock_token, nx=True, px=90000)  # 90s safety TTL
        if not acquired:
            # Another request is actively generating this report — return existing or fallback
            if existing:
                return report_service.format_report_response(existing, ipo)
            return report_service.build_fallback_report_response(ipo)

    try:
        return await report_service.get_or_generate_report(db, ipo, force_refresh=bool(force))
    finally:
        if redis:
            lua = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"
            try:
                await redis.eval(lua, 1, lock_key, lock_token)
            except Exception:
                pass



@router.get("/pnl/summary")
async def get_pnl_summary(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    """
    Realized P&L ledger summary:
    total invested, total realized, net P&L, ROI %, win/loss counts,
    and per-IPO sell breakdown sorted by most recent exit date.
    Guest users receive an empty summary.
    """
    if user and user.get("is_guest"):
        from app.services.demo_dataset import DEMO_ALLOTMENTS
        sold_allotments = [a for a in DEMO_ALLOTMENTS if a.get("status") == "SOLD"]
        total_inv = sum(a.get("invested_amount", 0.0) for a in sold_allotments)
        total_pnl = sum(a.get("realized_pnl", 0.0) for a in sold_allotments)
        roi = round((total_pnl / total_inv * 100.0), 1) if total_inv > 0 else 0.0
        return {
            "total_invested": total_inv,
            "total_realized": total_inv + total_pnl,
            "total_net_pnl": total_pnl,
            "overall_roi_percent": roi,
            "total_trades": len(sold_allotments),
            "wins": sum(1 for a in sold_allotments if a.get("realized_pnl", 0) > 0),
            "losses": sum(1 for a in sold_allotments if a.get("realized_pnl", 0) <= 0),
            "win_rate_percent": round(
                (sum(1 for a in sold_allotments if a.get("realized_pnl", 0) > 0) / len(sold_allotments) * 100.0), 1
            ) if sold_allotments else 0.0,
            "breakdown": [
                {
                    "ipo_name": a.get("ipo_name"),
                    "shares": a.get("allotted_shares"),
                    "invested": a.get("invested_amount"),
                    "realized_pnl": a.get("realized_pnl"),
                    "roi_percent": round((a.get("realized_pnl", 0) / a.get("invested_amount", 1) * 100.0), 1) if a.get("invested_amount") else 0.0,
                }
                for a in sold_allotments
            ],
        }
    return await pnl_service.get_summary(db)
