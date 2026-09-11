from sqlalchemy import Column, String, Float, Integer, ForeignKey, Date
from datetime import date
from app.models.base import BaseModel


class RealizedPnl(BaseModel):
    """
    Realized Profit & Loss ledger for completed IPO exits and pre-listing sells.
    """
    __tablename__ = "realized_pnl"

    allotment_id = Column(String(36), ForeignKey("allotments.id", ondelete="CASCADE"), nullable=False, unique=True)
    account_id = Column(String(36), ForeignKey("family_accounts.id", ondelete="CASCADE"), nullable=False)
    account_name = Column(String(100), nullable=False)
    ipo_name = Column(String(200), nullable=False)
    ipo_symbol = Column(String(50), nullable=False)
    
    shares_sold = Column(Integer, nullable=False)
    issue_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    invested_amount = Column(Float, nullable=False)
    realized_amount = Column(Float, nullable=False)
    net_pnl = Column(Float, nullable=False)
    roi_percent = Column(Float, nullable=False)
    
    exit_date = Column(Date, default=date.today, nullable=False)
    exit_type = Column(String(50), default="PRE_MARKET_LISTING")  # PRE_MARKET_LISTING, MANUAL_INTRADAY, CNC_HOLD
