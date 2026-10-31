from fastapi import APIRouter, Query, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.order import OrderResponse, OrderCreate, BatchOrderCreate, BatchOrderResponse
from app.services.order_service import order_service

from app.middleware.auth import get_current_user_optional, require_admin

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = Query(None, description="Filter by status: ALL, PENDING, SUBMITTED, CONFIRMED, REJECTED, CANCELLED"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    ipo: Optional[str] = Query(None, description="Filter by IPO name"),
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Audit log of all IPO applications submitted through Angel One SmartAPI from PostgreSQL."""
    if user and user.get("is_guest"):
        return []
    return await order_service.get_orders(
        db=db,
        status=status,
        account_name=account,
        ipo_name=ipo,
    )

@router.post("/apply", response_model=OrderResponse)
async def submit_ipo_bid(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Submit an ASBA IPO application with UPI mandate staging via SmartAPI and persist in PostgreSQL."""
    try:
        return await order_service.create_order(db=db, data=order_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch", response_model=BatchOrderResponse)
async def submit_batch_ipo_bids(
    batch_data: BatchOrderCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Submit multiple ASBA IPO applications in a single batch (e.g. from optimizer allocation plan)."""
    return await order_service.create_batch_orders(db=db, orders=batch_data.orders)


@router.post("/{order_id}/mark-applied", response_model=OrderResponse)
async def mark_staged_order_applied(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Mark an IPO application intent as successfully submitted in the broker app."""
    try:
        return await order_service.mark_applied(db=db, order_id=order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_staged_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Cancel a staged application and release the locked ASBA balance back to available funds."""
    try:
        return await order_service.cancel_order(db=db, order_id=order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{order_id}")
async def delete_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Delete an order record and release any locked ASBA funds."""
    try:
        return await order_service.delete_order(db=db, order_id=order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{order_id}/allotment")
async def update_order_allotment(
    order_id: str,
    result: str = Query(..., description="'ALLOTTED' or 'NOT_ALLOTTED'"),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Process registrar allotment result for a staged order:
    - NOT_ALLOTTED: Releases ASBA locked funds immediately.
    - ALLOTTED: Stages Demat holdings for listing day 09:00 AM auto-sell.
    """
    try:
        return await order_service.process_allotment_result(db=db, order_id=order_id, result=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
