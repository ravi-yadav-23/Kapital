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
    financial_quality: int = 0
    valuation_safety: int = 0
    gmp_strength: int = 0
    gmp_signal: int = 0
    subscription_momentum: int = 0
    subscription_hype: int = 0
    industry_tailwinds: int = 0
    industry_trend: int = 0
    promoter_integrity: int = 0
    allotment_probability: int = 0
    lock_in_conflict: int = 0
    total: int = 0

    def __init__(self, **data: Any):
        super().__init__(**data)
        if not self.gmp_signal and self.gmp_strength:
            self.gmp_signal = self.gmp_strength
        elif not self.gmp_strength and self.gmp_signal:
            self.gmp_strength = self.gmp_signal

        if not self.subscription_hype and self.subscription_momentum:
            self.subscription_hype = self.subscription_momentum
        elif not self.subscription_momentum and self.subscription_hype:
            self.subscription_momentum = self.subscription_hype

        if not self.industry_trend and self.industry_tailwinds:
            self.industry_trend = self.industry_tailwinds
        elif not self.industry_tailwinds and self.industry_trend:
            self.industry_tailwinds = self.industry_trend

        if not self.allotment_probability and self.valuation_safety:
            self.allotment_probability = self.valuation_safety
        elif not self.valuation_safety and self.allotment_probability:
            self.valuation_safety = self.allotment_probability

        if not self.lock_in_conflict and self.promoter_integrity:
            self.lock_in_conflict = self.promoter_integrity
        elif not self.promoter_integrity and self.lock_in_conflict:
            self.promoter_integrity = self.lock_in_conflict

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
