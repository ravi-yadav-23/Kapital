from pydantic import BaseModel
from typing import List, Optional

class FundSummaryResponse(BaseModel):
    total_family_balance: float
    total_available: float
    total_locked_asba: float
    utilization_percent: float
    accounts_active: int = 0
    accounts_total: int

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

class AllocationPlanResponse(BaseModel):
    plan_id: str
    generated_at: str
    total_capital_deployed: float
    entries: List[AllocationEntrySchema] = []
    skipped_ipos: List[SkippedIpoSchema] = []
    warnings: List[str] = []
    status: str = "OPTIMAL"
    asba_lock_overlaps_detected: int = 0
