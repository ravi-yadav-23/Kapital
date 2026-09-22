from sqlalchemy import Column, String, Float, Integer, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Ipo(BaseModel):
    __tablename__ = "ipos"

    external_id = Column(String(100), nullable=True)
    source = Column(String(50), default="bse")  # bse, nse, chittorgarh
    slug = Column(String(100), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    symbol = Column(String(50), nullable=False)
    type = Column(String(20), default="EQ")  # EQ, SME, REIT
    status = Column(String(30), default="upcoming")  # upcoming, open, closing_today, closed, allotted, listed
    logo_url = Column(String(500), nullable=True)

    # Pricing & Lot size
    price_band_min = Column(Float, nullable=False)
    price_band_max = Column(Float, nullable=False)
    lot_size = Column(Integer, nullable=False)
    min_investment = Column(Float, nullable=False)
    issue_size = Column(String(100), nullable=True)
    issue_size_cr = Column(Float, nullable=True)

    # Critical ASBA & Issue Dates
    issue_open_date = Column(Date, nullable=False)
    issue_close_date = Column(Date, nullable=False)
    allotment_date = Column(Date, nullable=True)
    refund_date = Column(Date, nullable=True)
    listing_date = Column(Date, nullable=True)

    # Narrative & Metadata
    about = Column(String(2000), nullable=True)
    strengths = Column(JSON, default=list)  # List of string points
    risks = Column(JSON, default=list)      # List of string points
    drhp_url = Column(String(500), nullable=True)
    rhp_url = Column(String(500), nullable=True)

    # AI Score & Recommendation
    score = Column(Integer, nullable=True)
    recommendation = Column(String(50), nullable=True)  # STRONG_APPLY, MODERATE_APPLY, WATCH, AVOID
    scored_at = Column(String(50), nullable=True)
    
    # Grey Market & Live Subscription
    gmp_percent = Column(Float, nullable=True)
    gmp_updated_at = Column(String(50), nullable=True)
    subscription_retail = Column(Float, default=0.0)
    subscription_shni = Column(Float, default=0.0)
    subscription_bhni = Column(Float, default=0.0)
    subscription_qib = Column(Float, default=0.0)
    subscription_total = Column(Float, default=0.0)

    # Relationships
    schedules = relationship("IpoSchedule", back_populates="ipo", cascade="all, delete-orphan", lazy="selectin")
    orders = relationship("IpoOrder", back_populates="ipo", lazy="selectin")
    allotments = relationship("Allotment", back_populates="ipo", lazy="selectin")


class IpoSchedule(BaseModel):
    __tablename__ = "ipo_schedules"

    ipo_id = Column(String(36), ForeignKey("ipos.id", ondelete="CASCADE"), nullable=False)
    event = Column(String(100), nullable=False)  # Issue open date, UPI mandate deadline, Allotment date, etc.
    event_date = Column(Date, nullable=False)

    ipo = relationship("Ipo", back_populates="schedules")
