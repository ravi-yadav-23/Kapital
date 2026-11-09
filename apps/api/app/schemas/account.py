from pydantic import BaseModel, Field, field_validator
from typing import Optional

from app.utils.security import mask_pan


class AccountCreate(BaseModel):
    name: str
    relation: str = "Self"
    angel_client_id: str
    angel_api_key: Optional[str] = None
    totp_secret: Optional[str] = None
    pin: Optional[str] = None
    pan: Optional[str] = None
    has_ddpi: bool = False
    tpin: Optional[str] = None
    total_balance: float = 0.0
    available_balance: float = 0.0
    preferred_category: str = "RETAIL"

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    pan: Optional[str] = None
    has_ddpi: Optional[bool] = None
    tpin: Optional[str] = None
    available_balance: Optional[float] = None
    preferred_category: Optional[str] = None
    is_active: Optional[bool] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    relation: str
    angel_client_id: str
    pan: Optional[str] = None
    has_ddpi: bool = False
    total_balance: float = 0.0
    available_balance: float = 0.0
    locked_balance: float = 0.0
    total_applied_ipos: int = 0
    total_allotments: int = 0
    total_realized_pnl: float = 0.0
    allotment_rate: float = 0.0
    preferred_category: str = "RETAIL"
    is_active: bool = True

    @field_validator("pan", mode="after")
    @classmethod
    def _mask_pan(cls, v: Optional[str]) -> Optional[str]:
        """
        A PAN is a full KYC identity identifier. It is never returned in clear
        text over the API - only masked. Internal consumers that legitimately
        need the raw value (e.g. the SEBI one-bid-per-PAN optimizer constraint)
        read the raw column directly from the ORM model / internal dict cache.
        """
        return mask_pan(v)

    class Config:
        from_attributes = True
