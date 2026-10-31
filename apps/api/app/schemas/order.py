from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class OrderCreate(BaseModel):
    account_id: str
    ipo_id: str
    category: str = "RETAIL"
    lots: int = 1
    bid_price: Optional[float] = None
    upi_vpa: str

class BatchOrderCreate(BaseModel):
    ipo_id: Optional[str] = None
    orders: List[OrderCreate]

class OrderResponse(BaseModel):
    id: str
    account_id: str
    ipo_id: str
    account_name: str
    ipo_name: str
    category: str
    lots: int
    shares: int
    bid_price: float
    amount: float
    upi_vpa: str
    angel_order_id: Optional[str] = None
    status: str
    reject_reason: Optional[str] = None
    placed_at: str

    class Config:
        from_attributes = True

class BatchOrderFailedItem(BaseModel):
    account_id: str
    ipo_id: str
    reason: str

class BatchOrderResponse(BaseModel):
    succeeded: List[OrderResponse]
    failed: List[BatchOrderFailedItem]
    total_requested: int
    total_staged: int
    total_amount_locked: float

