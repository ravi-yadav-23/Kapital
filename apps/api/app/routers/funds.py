from fastapi import APIRouter, Depends, Response, HTTPException
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from celery.result import AsyncResult

from app.db.database import get_db
from app.schemas.fund import FundSummaryResponse, PnlSummaryResponse, AllocationPlanResponse, UpcomingConflictSchema
from app.schemas.account import AccountResponse, AccountCreate, AccountUpdate
from app.schemas.allotment import AsbaLockResponse
from app.services.account_service import account_service
from app.services.ipo_service import ipo_service
from app.services.allotment_service import allotment_service
from app.services.optimizer_service import AllocationOptimizer
from app.services.demo_dataset import demo_dataset, DEMO_ACCOUNTS
from app.tasks.celery_app import celery, run_optimizer_celery

from app.middleware.auth import get_current_user_optional, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/funds", tags=["funds"])

# In-memory fallback store for optimizer results when Celery workers are not running
_optimizer_task_store: Dict[str, Dict[str, Any]] = {}


@router.get("/summary", response_model=FundSummaryResponse)
async def get_fund_summary(
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Get overall family corpus balance, available deployment liquidity, and ASBA locked totals."""
    response.headers["Cache-Control"] = "public, max-age=30"
    if user and user.get("is_guest"):
        return demo_dataset.get_fund_summary()

    accounts = await account_service.get_all_accounts(db)
    asba_locks = await allotment_service.get_asba_locks(db)
    total_family    = sum(a.total_balance or 0.0 for a in accounts)
    total_available = sum(a.available_balance or 0.0 for a in accounts)
    total_locked    = sum(a.locked_balance or 0.0 for a in accounts)
    utilization     = (total_locked / total_family * 100.0) if total_family > 0 else 0.0
    active_count    = sum(1 for a in accounts if a.is_active)
    active_locks    = len(asba_locks) if asba_locks else 0

    return FundSummaryResponse(
        total_family_balance=total_family,
        total_available=total_available,
        total_locked_asba=total_locked,
        utilization_percent=round(utilization, 1),
        accounts_active=active_count,
        accounts_total=len(accounts),
        active_asba_locks=active_locks,
    )



@router.get("/pnl-summary", response_model=PnlSummaryResponse)
async def get_pnl_summary(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Get family historical realized P&L, overall ROI, active lots, and lottery hit rates."""
    if user and user.get("is_guest"):
        return demo_dataset.get_pnl_summary()

    allotments = await allotment_service.get_allotments(db)
    accounts   = await account_service.get_all_accounts(db)

    total_pnl      = sum(alt.realized_pnl or 0.0 for alt in allotments if alt.status == "SOLD")
    total_invested = sum(alt.invested_amount or 0.0 for alt in allotments if alt.status == "SOLD")
    overall_roi    = (total_pnl / total_invested * 100.0) if total_invested > 0 else 0.0
    active_holding = len([alt for alt in allotments if alt.status == "ACTIVE"])
    total_allot    = len([alt for alt in allotments if alt.status in ["ACTIVE", "SOLD"]])

    total_bids = sum(a.total_applied_ipos or 0 for a in accounts)
    total_wins = sum(a.total_allotments or 0 for a in accounts)
    allotment_rate = (total_wins / total_bids * 100.0) if total_bids > 0 else 0.0

    return PnlSummaryResponse(
        total_realized_pnl=total_pnl,
        overall_roi_percent=round(overall_roi, 1),
        total_allotments=total_allot,
        total_holding=active_holding,
        allotment_rate_percent=round(allotment_rate, 1),
    )


@router.get("/accounts", response_model=List[AccountResponse])
async def list_family_accounts(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """List all registered family demat accounts. Returns demo accounts for guest mode."""
    if user and user.get("is_guest"):
        return demo_dataset.get_accounts()
    return await account_service.get_all_accounts(db)


@router.post("/accounts", response_model=AccountResponse)
async def add_family_account(
    data: AccountCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Register a new family demat account with Angel One SmartAPI credentials."""
    return await account_service.create_account(db, data)


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_family_account(
    account_id: str,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Update family member balance or category preferences."""
    if user and user.get("is_guest"):
        updated_demo = demo_dataset.update_account(account_id, data.model_dump(exclude_unset=True))
        if updated_demo:
            return updated_demo
    return await account_service.update_account(db, account_id, data)


@router.post("/accounts/{account_id}/sync", response_model=AccountResponse)
async def sync_account_rms_balance(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Trigger live Angel One RMS balance fetch and update demat balance in PostgreSQL."""
    from app.models.account import FamilyAccount
    from fastapi import HTTPException
    res = await db.execute(
        select(FamilyAccount).where((FamilyAccount.id == account_id) | (FamilyAccount.angel_client_id == account_id))
    )
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    updated = await account_service.sync_live_balance(db, acc.angel_client_id)
    await db.commit()
    return updated


@router.post("/accounts/sync-all")
async def sync_all_accounts_balance(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Trigger live Angel One RMS balance fetch for all connected family accounts."""

    accounts = await account_service.get_all_accounts(db)
    synced = []
    for a in accounts:
        if a.angel_client_id:
            upd = await account_service.sync_live_balance(db, a.angel_client_id)
            if upd:
                synced.append(upd)
    await db.commit()
    return {"success": True, "synced_accounts": len(synced)}



@router.post("/optimize", status_code=202)
async def run_pulp_optimization(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Enqueue PuLP MILP optimizer as an asynchronous background task.
    Returns HTTP 202 Accepted with a task_id for polling status.
    """
    is_guest = not user or user.get("is_guest")
    try:
        db_accounts = await account_service.get_all_accounts(db)
        db_ipos = await ipo_service.get_all_ipos(db)

        using_demo = bool(is_guest or not db_accounts)
        if using_demo:
            accounts_data = [
                {
                    "id": a["id"],
                    "name": a["name"],
                    "relation": a.get("relation", "Self"),
                    "angel_client_id": a.get("angel_client_id", ""),
                    "available_liquid_balance": a.get("available_balance", 0.0),
                    "preferred_category": a.get("preferred_category", "RETAIL"),
                    "is_active": a.get("is_active", True),
                }
                for a in DEMO_ACCOUNTS
            ]
        else:
            accounts_data = [
                {
                    "id": a.id,
                    "name": a.name,
                    "relation": a.relation,
                    "angel_client_id": a.angel_client_id,
                    "available_liquid_balance": a.available_balance,
                    "preferred_category": a.preferred_category or "RETAIL",
                    "is_active": a.is_active,
                }
                for a in db_accounts
            ]

        ipos_data = [
            {
                "id": ipo.id,
                "name": ipo.name,
                "symbol": ipo.symbol,
                "status": ipo.status,
                "type": getattr(ipo, "type", "EQ"),
                "issue_type": getattr(ipo, "type", "EQ"),
                # All date fields needed for ASBA conflict detection
                "issue_open_date": str(ipo.issue_open_date) if ipo.issue_open_date else None,
                "issue_close_date": str(ipo.issue_close_date) if ipo.issue_close_date else None,
                "allotment_date": str(ipo.allotment_date) if ipo.allotment_date else None,
                "refund_date": str(ipo.refund_date) if ipo.refund_date else None,
                "listing_date": str(ipo.listing_date) if ipo.listing_date else None,
                "lot_size": ipo.lot_size or 1,
                "price_band_min": ipo.price_band_min or 100.0,
                "price_band_max": ipo.price_band_max or 100.0,
                "min_investment": ipo.min_investment or ((ipo.lot_size or 1) * (ipo.price_band_max or 100.0)),
                "gmp_percent": min(float(ipo.gmp_percent or 0.0), 80.0),  # Cap at 80%
                "score": ipo.score or 50,
            }
            for ipo in db_ipos
        ]

        task_id = f"plan-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        _optimizer_task_store[task_id] = {
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Try dispatching to Celery worker; fall back gracefully to async thread task
        dispatched_to_celery = False
        try:
            run_optimizer_celery.apply_async(
                args=[accounts_data, ipos_data, using_demo],
                task_id=task_id,
            )
            dispatched_to_celery = True
        except Exception as e:
            logger.info(f"Celery worker unavailable ({e}). Running optimizer in non-blocking async task.")

        if not dispatched_to_celery:
            async def _bg_solve():
                try:
                    plan = await asyncio.to_thread(
                        AllocationOptimizer.solve_allocation,
                        accounts=accounts_data,
                        ipos=ipos_data,
                    )
                    res = plan.model_dump()
                    if using_demo:
                        res["is_demo"] = True
                        res["warnings"] = [
                            "DEMO MODE: Showing sample allocation plan with demo family accounts. Add your real family accounts to see your personalized allocation."
                        ] + res.get("warnings", [])
                    _optimizer_task_store[task_id] = {
                        "status": "SUCCESS",
                        "result": res,
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    }
                except Exception as exc:
                    logger.error(f"In-process optimizer background task failed: {exc}", exc_info=True)
                    _optimizer_task_store[task_id] = {
                        "status": "FAILURE",
                        "error": str(exc),
                    }

            asyncio.create_task(_bg_solve())

        return {
            "task_id": task_id,
            "status": "QUEUED",
            "message": "Optimizer task started. Poll status endpoint for result.",
            "poll_url": f"/api/funds/optimize/status/{task_id}",
        }

    except Exception as exc:
        logger.error(f"Failed to initiate PuLP optimization: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Optimization unavailable at this moment: {str(exc)}",
        )


@router.get("/optimize/status/{task_id}", response_model=AllocationPlanResponse)
async def get_optimization_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Poll the status of an active or completed PuLP optimization task.
    Returns AllocationPlanResponse with status='PENDING' while calculating,
    or final 'OPTIMAL' plan when complete.
    """
    # 1. Check in-process fallback store
    if task_id in _optimizer_task_store:
        record = _optimizer_task_store[task_id]
        if record.get("status") == "PENDING":
            return AllocationPlanResponse(
                plan_id=task_id,
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="PENDING",
                asba_lock_overlaps_detected=0,
                warnings=["Optimizer calculation in progress..."],
            )
        elif record.get("status") == "FAILURE":
            return AllocationPlanResponse(
                plan_id=task_id,
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="ERROR",
                asba_lock_overlaps_detected=0,
                warnings=[f"Optimizer error: {record.get('error', 'Unknown error')}"],
            )
        elif record.get("status") == "SUCCESS":
            return AllocationPlanResponse(**record["result"])

    # 2. Check Celery AsyncResult
    try:
        task_res = AsyncResult(task_id, app=celery)
        if not task_res.ready():
            return AllocationPlanResponse(
                plan_id=task_id,
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="PENDING",
                asba_lock_overlaps_detected=0,
                warnings=["Optimizer calculation in progress..."],
            )

        if task_res.failed():
            return AllocationPlanResponse(
                plan_id=task_id,
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="ERROR",
                asba_lock_overlaps_detected=0,
                warnings=[f"Optimizer failed: {str(task_res.result)}"],
            )

        val = task_res.result
        if isinstance(val, dict):
            return AllocationPlanResponse(**val)
    except Exception as e:
        logger.warning(f"Error checking Celery task {task_id}: {e}")

    raise HTTPException(status_code=404, detail="Optimizer task not found")


@router.get("/locks", response_model=List[AsbaLockResponse])
async def list_asba_locks(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Get ASBA fund lock and liquidity recycling timeline."""
    if user and user.get("is_guest"):
        return demo_dataset.get_asba_locks()
    return await allotment_service.get_asba_locks(db)
