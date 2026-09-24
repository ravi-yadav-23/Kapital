from fastapi import APIRouter, Depends, Response
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.schemas.fund import FundSummaryResponse, PnlSummaryResponse, AllocationPlanResponse
from app.schemas.account import AccountResponse, AccountCreate, AccountUpdate
from app.schemas.allotment import AsbaLockResponse
from app.services.account_service import account_service
from app.services.ipo_service import ipo_service
from app.services.allotment_service import allotment_service
from app.services.optimizer_service import AllocationOptimizer

from app.middleware.auth import get_current_user_optional, require_admin

router = APIRouter(prefix="/funds", tags=["funds"])


@router.get("/summary", response_model=FundSummaryResponse)
async def get_fund_summary(
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Get overall family corpus balance, available deployment liquidity, and ASBA locked totals."""
    response.headers["Cache-Control"] = "public, max-age=30"
    if user and user.get("is_guest"):
        return FundSummaryResponse(
            total_family_balance=0.0,
            total_available=0.0,
            total_locked_asba=0.0,
            utilization_percent=0.0,
            accounts_active=0,
            accounts_total=0,
        )

    accounts = await account_service.get_all_accounts(db)
    total_family    = sum(a.total_balance or 0.0 for a in accounts)
    total_available = sum(a.available_balance or 0.0 for a in accounts)
    total_locked    = sum(a.locked_balance or 0.0 for a in accounts)
    utilization     = (total_locked / total_family * 100.0) if total_family > 0 else 0.0
    active_count    = sum(1 for a in accounts if a.is_active)

    return FundSummaryResponse(
        total_family_balance=total_family,
        total_available=total_available,
        total_locked_asba=total_locked,
        utilization_percent=round(utilization, 1),
        accounts_active=active_count,
        accounts_total=len(accounts),
    )



@router.get("/pnl-summary", response_model=PnlSummaryResponse)
async def get_pnl_summary(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Get family historical realized P&L, overall ROI, active lots, and lottery hit rates."""
    if user and user.get("is_guest"):
        return PnlSummaryResponse(
            total_realized_pnl=0.0,
            overall_roi_percent=0.0,
            total_allotments=0,
            total_holding=0,
            allotment_rate_percent=0.0,
        )

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
    """List all registered family demat accounts. Returns empty for guest mode."""
    if user and user.get("is_guest"):
        return []
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
    admin: dict = Depends(require_admin),
):
    """Update family member balance or category preferences."""
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



@router.post("/optimize", response_model=AllocationPlanResponse)
async def run_pulp_optimization(db: AsyncSession = Depends(get_db)):
    """Execute PuLP MILP solver to compute optimal capital distribution using real accounts and active IPOs."""
    db_accounts = await account_service.get_all_accounts(db)
    db_ipos = await ipo_service.get_all_ipos(db)

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
            "issue_type": getattr(ipo, "type", "EQ"),
            "lot_size": ipo.lot_size or 1,
            "price_band_min": ipo.price_band_min or 100.0,
            "price_band_max": ipo.price_band_max or 100.0,
            "min_investment": ipo.min_investment or ((ipo.lot_size or 1) * (ipo.price_band_max or 100.0)),
            "gmp_percent": ipo.gmp_percent or 0.0,
            "score": ipo.score or 50,
        }
        for ipo in db_ipos
    ]

    plan = AllocationOptimizer.solve_allocation(
        accounts=accounts_data,
        ipos=ipos_data,
    )
    return plan


@router.get("/locks", response_model=List[AsbaLockResponse])
async def list_asba_locks(db: AsyncSession = Depends(get_db)):
    """Get ASBA fund lock and liquidity recycling timeline."""
    return await allotment_service.get_asba_locks(db)
