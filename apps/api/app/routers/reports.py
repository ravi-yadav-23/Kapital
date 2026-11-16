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
from app.middleware.auth import get_viewer

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
    from app.services.rating import attach_facts
    await attach_facts(db, [r[0] for r in rows])

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
        raise HTTPException(status_code=404, detail="IPO not found")
    from app.services.rating import attach_facts
    await attach_facts(db, [ipo])

    stmt_rep = select(AiReport).where(AiReport.ipo_id == ipo.id)
    res_rep = await db.execute(stmt_rep)
    existing = res_rep.scalar_one_or_none()
    if existing:
        return report_service.format_report_response(existing, ipo)

    return report_service.build_fallback_report_response(ipo)


@router.get("/pnl/summary")
async def get_pnl_summary(
    db: AsyncSession = Depends(get_db),
    viewer: dict = Depends(get_viewer),
) -> Dict[str, Any]:
    """
    Realized P&L ledger summary:
    total invested, total realized, net P&L, ROI %, win/loss counts,
    and per-IPO sell breakdown sorted by most recent exit date.
    Guest users receive the demo summary.
    """
    if viewer.get("is_guest"):
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
