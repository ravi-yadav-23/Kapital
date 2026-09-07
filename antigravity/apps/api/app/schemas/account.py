from pydantic import BaseModel, Field
from typing import Optional

class AccountCreate(BaseModel):
    name: str
    relation: str = "Self"
    angel_client_id: str
    angel_api_key: Optional[str] = None
    totp_secret: Optional[str] = None
    pin: Optional[str] = None
    total_balance: float = 0.0
    available_balance: float = 0.0
    preferred_category: str = "RETAIL"

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    available_balance: Optional[float] = None
    preferred_category: Optional[str] = None
    is_active: Optional[bool] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    relation: str
    angel_client_id: str
    total_balance: float = 0.0
    available_balance: float = 0.0
    locked_balance: float = 0.0
    total_applied_ipos: int = 0
    total_allotments: int = 0
    total_realized_pnl: float = 0.0
    allotment_rate: float = 0.0
    preferred_category: str = "RETAIL"
    is_active: bool = True

    class Config:
        from_attributes = True
