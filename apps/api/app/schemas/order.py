from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class OrderCreate(BaseModel):
    account_id: str
    ipo_id: str
    category: str = "RETAIL"
    lots: int = 1
    bid_price: float
    upi_vpa: str

class BatchOrderCreate(BaseModel):
    ipo_id: str
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
