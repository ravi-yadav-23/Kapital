from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.ipo import Ipo
from app.schemas.report import AiReportResponse
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=List[AiReportResponse])
async def list_ai_reports(db: AsyncSession = Depends(get_db)):
    """List all analyzed AI Due Diligence reports with 6-dimension scores from PostgreSQL."""
    stmt = select(Ipo)
    res = await db.execute(stmt)
    ipos = res.scalars().all()
    reports = []
    for ipo in ipos:
        rep = await report_service.get_or_generate_report(db, ipo)
        reports.append(rep)
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
