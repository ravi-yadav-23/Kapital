from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
async def get_ai_report(ipo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get full AI Due Diligence & Red Flag audit report for a specific IPO.
    Fetches the single-run cached report from the database if available.
    """
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()

    if not ipo:
        # Check if benchmark IPOs need to be seeded
        await seed_initial_ipos_and_reports(db)
        res = await db.execute(stmt)
        ipo = res.scalar_one_or_none()

    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")

    return await report_service.get_or_generate_report(db, ipo, force_refresh=False)


@router.post("/{ipo_id}/generate", response_model=AiReportResponse)
async def trigger_ai_analysis(
    ipo_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user_optional),
):
    """
    Trigger or view AI due diligence analysis for an IPO.
    - If a report already exists in the DB, it returns the cached report with 0 LLM cost.
    - Guest and demo accounts can view and generate the single-run report without 403 errors.
    - Only authenticated administrators can force a fresh LLM re-run with force_refresh=True.
    """
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()

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

    is_admin = bool(user and user.get("role") == "ADMIN" and not user.get("is_guest"))

    if existing and not is_admin:
        # For non-admin or guest users, return the existing cached report immediately
        return report_service.format_report_response(existing, ipo)

    # If admin and existing, allow force_refresh; otherwise generate once and persist to DB
    return await report_service.get_or_generate_report(db, ipo, force_refresh=(is_admin and existing is not None))



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
