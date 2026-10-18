from sqlalchemy import Column, String, Float, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class AiReport(BaseModel):
    __tablename__ = "ai_reports"

    ipo_id = Column(String(36), ForeignKey("ipos.id", ondelete="CASCADE"), unique=True, nullable=False)
    version = Column(String(20), default="1.0.0")
    
    # Overall Score & Recommendation
    overall_score = Column(Integer, nullable=False)  # 0 to 100
    recommendation = Column(String(50), nullable=False)  # STRONG_APPLY, MODERATE_APPLY, WATCH, AVOID
    
    # 6-Dimension Score Breakdown (0 to 100 or weighted)
    score_financial_quality = Column(Integer, default=0)
    score_industry_tailwinds = Column(Integer, default=0)
    score_subscription_momentum = Column(Integer, default=0)
    score_valuation_safety = Column(Integer, default=0)
    score_gmp_strength = Column(Integer, default=0)
    score_promoter_integrity = Column(Integer, default=0)

    # Narrative Breakdown & AI Findings
    executive_summary = Column(Text, nullable=True)
    strengths = Column(JSON, default=list)
    risks = Column(JSON, default=list)
    red_flags = Column(JSON, default=list)  # List of objects: [{title, severity: 'HIGH'|'MEDIUM'|'LOW', description, penalty_points}]
    
    # Market & Valuation Metrics
    gmp_percent = Column(Float, nullable=True)
    estimated_listing_price = Column(Float, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    peer_avg_pe = Column(Float, nullable=True)
    ofs_percentage = Column(Float, nullable=True)  # Offer For Sale % vs Fresh Issue
    
    scored_at = Column(String(50), nullable=True)

    ipo = relationship("Ipo", back_populates="report")
