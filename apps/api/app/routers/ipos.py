from fastapi import APIRouter, Query, HTTPException, Depends, Response
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.ipo import IpoResponse
from app.services.ipo_service import ipo_service
from app.tasks.ipo_tasks import sync_ipos_pipeline

router = APIRouter(prefix="/ipos", tags=["ipos"])

@router.get("", response_model=List[IpoResponse])
async def list_ipos(
    response: Response,
    status: Optional[str] = Query(None, description="Filter by status: open, upcoming, closing_today, closed, all"),
    type: Optional[str] = Query(None, description="Filter by type: EQ, SME, REIT, ALL"),
    min_score: Optional[int] = Query(None, description="Filter by minimum AI score"),
    max_investment: Optional[float] = Query(None, description="Filter by maximum retail investment"),
    db: AsyncSession = Depends(get_db),
):
    """Fetch active, closing today, upcoming, and closed IPO issues with AI scores & subscription rates from PostgreSQL."""
    response.headers["Cache-Control"] = "public, max-age=30, s-maxage=60, stale-while-revalidate=600"
    return await ipo_service.get_all_ipos(
        db=db,
        status=status,
        ipo_type=type,
        min_score=min_score,
        max_investment=max_investment,
    )

@router.get("/{ipo_id}", response_model=IpoResponse)
async def get_ipo_details(ipo_id: str, response: Response, db: AsyncSession = Depends(get_db)):
    """Get full details of a specific IPO issue by ID or slug."""
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=120, stale-while-revalidate=600"
    ipo = await ipo_service.get_ipo_by_id(db, ipo_id)
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO issue not found")
    return ipo

@router.post("/sync")
async def sync_market_data(db: AsyncSession = Depends(get_db)):
    """Trigger real-time sync for current Indian IPOs pipeline into PostgreSQL."""
    count = await sync_ipos_pipeline(db)
    return {"success": True, "message": f"Successfully synchronized {count} live IPOs into PostgreSQL database"}
