from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class RedFlagSchema(BaseModel):
    title: Optional[str] = "Risk Flag"
    type: Optional[str] = None
    severity: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    description: str = ""
    flag: Optional[str] = None
    penalty_points: int = 5
    penalty: Optional[int] = None

    def __init__(self, **data: Any):
        super().__init__(**data)
        desc = self.description or self.title or self.type or "Risk Factor Identified"
        if not self.description:
            self.description = desc
        if not self.title:
            self.title = self.type or desc
        if not self.flag:
            self.flag = self.description or self.title
        if self.penalty is None:
            self.penalty = self.penalty_points

class ScoreBreakdownSchema(BaseModel):
    financial_quality: Optional[int] = None
    valuation_safety: Optional[int] = None
    gmp_strength: Optional[int] = None
    gmp_signal: Optional[int] = None
    subscription_momentum: Optional[int] = None
    subscription_hype: Optional[int] = None
    industry_tailwinds: Optional[int] = None
    industry_trend: Optional[int] = None
    promoter_integrity: Optional[int] = None
    allotment_probability: Optional[int] = None
    lock_in_conflict: Optional[int] = None
    total: int = 0

    def __init__(self, **data: Any):
        super().__init__(**data)
        if self.gmp_signal is None and self.gmp_strength is not None:
            self.gmp_signal = self.gmp_strength
        elif self.gmp_strength is None and self.gmp_signal is not None:
            self.gmp_strength = self.gmp_signal

        if self.subscription_hype is None and self.subscription_momentum is not None:
            self.subscription_hype = self.subscription_momentum
        elif self.subscription_momentum is None and self.subscription_hype is not None:
            self.subscription_momentum = self.subscription_hype

        if self.industry_trend is None and self.industry_tailwinds is not None:
            self.industry_trend = self.industry_tailwinds
        elif self.industry_tailwinds is None and self.industry_trend is not None:
            self.industry_tailwinds = self.industry_trend

        if self.allotment_probability is None and self.valuation_safety is not None:
            self.allotment_probability = self.valuation_safety
        elif self.valuation_safety is None and self.allotment_probability is not None:
            self.valuation_safety = self.allotment_probability

        if self.lock_in_conflict is None and self.promoter_integrity is not None:
            self.lock_in_conflict = self.promoter_integrity
        elif self.promoter_integrity is None and self.lock_in_conflict is not None:
            self.promoter_integrity = self.lock_in_conflict

class AiReportResponse(BaseModel):
    id: str
    ipo_id: str
    ipo_name: Optional[str] = None
    ipo_symbol: Optional[str] = None
    overall_score: int
    is_audited: bool = False
    recommendation: str
    score_breakdown: ScoreBreakdownSchema
    executive_summary: Optional[str] = None
    summary_source: Optional[str] = "ai_generated"
    strengths: List[str] = []
    risks: List[str] = []
    red_flags: List[RedFlagSchema] = []
    gmp_percent: Optional[float] = None
    estimated_listing_price: Optional[float] = None
    scored_at: Optional[str] = None

    class Config:
        from_attributes = True
