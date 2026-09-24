from fastapi import APIRouter, Query, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.allotment import AllotmentResponse, StageSellRequest
from app.services.allotment_service import allotment_service

from app.middleware.auth import get_current_user_optional, require_admin

router = APIRouter(prefix="/allotments", tags=["allotments"])

@router.get("", response_model=List[AllotmentResponse])
async def list_allotments(
    status: Optional[str] = Query(None, description="Filter: ALL, ACTIVE, SOLD, INACTIVE"),
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Fetch active demat holdings, executed sales, and unallocated refunds from PostgreSQL."""
    if user and user.get("is_guest"):
        return []
    return await allotment_service.get_allotments(db=db, status=status)

@router.post("/{allotment_id}/stage-sell")
async def stage_pre_listing_sell(
    allotment_id: str,
    data: StageSellRequest,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Configure and stage 09:00:00 AM IST pre-market limit sell order on listing day."""
    res = await allotment_service.stage_sell_order(db=db, allotment_id=allotment_id, data=data)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res


@router.post("/sync-broker-allotments")
async def trigger_broker_allotment_sync(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Automated registrar / depository sync:
    Scans Angel One demat holdings for all family accounts to automatically detect credited IPO shares.
    Stages won allotments and releases ASBA locked capital for non-allotted bids.
    """
    return await allotment_service.auto_detect_allotments(db)

