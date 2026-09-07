from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class IpoScheduleSchema(BaseModel):
    event: str
    date: str

class IpoBase(BaseModel):
    symbol: str
    name: str
    slug: str
    type: str = "EQ"
    status: str = "upcoming"
    logo_url: Optional[str] = None
    price_band_min: float
    price_band_max: float
    lot_size: int
    min_investment: float
    issue_size: Optional[str] = None
    issue_size_cr: Optional[float] = None
    issue_open_date: str
    issue_close_date: str
    allotment_date: Optional[str] = None
    refund_date: Optional[str] = None
    listing_date: Optional[str] = None
    about: Optional[str] = None
    strengths: List[str] = []
    risks: List[str] = []
    score: Optional[int] = None
    recommendation: Optional[str] = None
    gmp_percent: Optional[float] = None
    subscription_retail: Optional[float] = 0.0
    subscription_shni: Optional[float] = 0.0
    subscription_bhni: Optional[float] = 0.0
    subscription_qib: Optional[float] = 0.0
    subscription_total: Optional[float] = 0.0

class IpoResponse(IpoBase):
    id: str
    schedule: List[IpoScheduleSchema] = []

    class Config:
        from_attributes = True
