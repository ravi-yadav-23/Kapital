from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class RedFlagSchema(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    severity: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    description: str = ""
    penalty_points: int = 0

    def __init__(self, **data: Any):
        super().__init__(**data)
        if not self.title and self.type:
            self.title = self.type
        elif not self.title:
            self.title = "Risk Flag"

class ScoreBreakdownSchema(BaseModel):
    financial_quality: int = 0
    industry_tailwinds: int = 0
    subscription_momentum: int = 0
    valuation_safety: int = 0
    gmp_strength: int = 0
    promoter_integrity: int = 0

class AiReportResponse(BaseModel):
    id: str
    ipo_id: str
    ipo_name: Optional[str] = None
    ipo_symbol: Optional[str] = None
    overall_score: int
    recommendation: str
    score_breakdown: ScoreBreakdownSchema
    executive_summary: Optional[str] = None
    strengths: List[str] = []
    risks: List[str] = []
    red_flags: List[RedFlagSchema] = []
    gmp_percent: Optional[float] = None
    estimated_listing_price: Optional[float] = None
    scored_at: Optional[str] = None

    class Config:
        from_attributes = True
