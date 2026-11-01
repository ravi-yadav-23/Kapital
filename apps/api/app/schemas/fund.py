from pydantic import BaseModel
from typing import List, Optional, Any, Dict


class FundSummaryResponse(BaseModel):
    total_family_balance: float
    total_available: float
    total_locked_asba: float
    utilization_percent: float
    accounts_active: int = 0
    accounts_total: int
    active_asba_locks: int = 0


class PnlSummaryResponse(BaseModel):
    total_realized_pnl: float
    overall_roi_percent: float
    total_allotments: int
    total_holding: int
    allotment_rate_percent: float


class AllocationEntrySchema(BaseModel):
    account_id: str
    account_name: str
    ipo_id: str
    ipo_name: str
    category: str
    lots: int
    amount: float
    expected_return_pct: float
    reason: Optional[str] = None


class SkippedIpoSchema(BaseModel):
    ipo_id: str
    reason: str


class UpcomingConflictSchema(BaseModel):
    """
    Describes an upcoming high-score IPO whose bidding window opens before
    the ASBA funds from a currently-applied IPO are released.
    """
    upcoming_ipo_name: str
    upcoming_score: int = 0
    upcoming_gmp: float = 0.0
    open_date: Optional[str] = None
    conflicts: List[Dict[str, Any]] = []   # list of {blocking_ipo, asba_free_date, upcoming_open_date}


class AllocationPlanResponse(BaseModel):
    plan_id: str
    generated_at: str
    total_capital_deployed: float
    entries: List[AllocationEntrySchema] = []
    skipped_ipos: List[SkippedIpoSchema] = []
    warnings: List[str] = []
    status: str = "OPTIMAL"
    is_demo: bool = False
    asba_lock_overlaps_detected: int = 0
    upcoming_conflicts: List[UpcomingConflictSchema] = []
