from pydantic import BaseModel
from typing import Optional

class StageSellRequest(BaseModel):
    limit_price: float
    trigger_time: str = "09:00:00"
    buffer_percent: float = 5.0

class AllotmentResponse(BaseModel):
    id: str
    account_id: str
    ipo_id: str
    account_name: str
    ipo_name: str
    ipo_symbol: str
    allotted_shares: int
    issue_price: float
    invested_amount: float
    status: str
    current_price: Optional[float] = None
    listing_date: Optional[str] = None
    staged_sell_limit_price: Optional[float] = None
    sell_order_id: Optional[str] = None
    sell_price: Optional[float] = None
    sell_date: Optional[str] = None
    realized_pnl: Optional[float] = None
    roi_percent: Optional[float] = None

    class Config:
        from_attributes = True

class AsbaLockResponse(BaseModel):
    id: str
    account_id: str
    ipo_id: str
    account_name: str
    ipo_name: str
    amount: float
    lock_date: str
    release_date: str
    next_ipo_conflict: Optional[str] = None
    is_conflict: bool = False

    class Config:
        from_attributes = True
