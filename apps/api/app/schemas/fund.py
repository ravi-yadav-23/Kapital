from pydantic import BaseModel, model_validator
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


# UPI-based IPO bids are capped at Rs 5,00,000 per application; larger bids must use net-banking ASBA.
UPI_IPO_LIMIT = 500_000.0


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
    shares: Optional[int] = None
    lot_size: Optional[int] = None
    payment_method: Optional[str] = None  # "UPI" or "NET_BANKING_ASBA"; derived from amount when omitted

    @model_validator(mode="after")
    def _default_payment_method(self):
        if not self.payment_method:
            self.payment_method = "UPI" if self.amount <= UPI_IPO_LIMIT else "NET_BANKING_ASBA"
        return self


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
