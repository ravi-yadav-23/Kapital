from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.ipo import Ipo
from app.schemas.report import AiReportResponse
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


from app.models.report import AiReport

@router.get("", response_model=List[AiReportResponse])
async def list_ai_reports(db: AsyncSession = Depends(get_db)):
    """
    List all generated AI Due Diligence reports with 6-dimension scores.
    Single SQL JOIN query that never blocks on synchronous LLM calls.
    """
    stmt = (
        select(AiReport, Ipo)
        .join(Ipo, AiReport.ipo_id == Ipo.id)
        .order_by(AiReport.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()
    reports = []
    for report_row, ipo_row in rows:
        reports.append(report_service.format_report_response(report_row, ipo_row))
    return reports


@router.get("/{ipo_id}", response_model=AiReportResponse)
async def get_ai_report(ipo_id: str, db: AsyncSession = Depends(get_db)):
    """Get full AI Due Diligence & Red Flag audit report for a specific IPO."""
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")
    return await report_service.get_or_generate_report(db, ipo)


@router.post("/{ipo_id}/generate", response_model=AiReportResponse)
async def trigger_ai_analysis(ipo_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger real-time DRHP extraction and GMP sentiment scoring for an IPO."""
    stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id))
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")
    return await report_service.get_or_generate_report(db, ipo, force_refresh=True)
