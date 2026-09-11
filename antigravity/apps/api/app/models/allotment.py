from sqlalchemy import Column, String, Float, Integer, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Allotment(BaseModel):
    __tablename__ = "allotments"

    account_id = Column(String(36), ForeignKey("family_accounts.id", ondelete="CASCADE"), nullable=False)
    ipo_id = Column(String(36), ForeignKey("ipos.id", ondelete="CASCADE"), nullable=False)
    
    account_name = Column(String(100), nullable=False)
    angel_client_id = Column(String(50), nullable=True)
    ipo_name = Column(String(200), nullable=False)
    ipo_symbol = Column(String(50), nullable=False)
    
    allotted_shares = Column(Integer, nullable=False)
    issue_price = Column(Float, nullable=False)
    invested_amount = Column(Float, nullable=False)
    status = Column(String(30), default="ACTIVE")  # ACTIVE, SOLD, INACTIVE (Refunded)
    
    # Pre-listing staging & execution metrics
    current_price = Column(Float, nullable=True)
    listing_date = Column(Date, nullable=True)
    staged_sell_limit_price = Column(Float, nullable=True)
    sell_order_id = Column(String(100), nullable=True)
    sell_price = Column(Float, nullable=True)
    sell_date = Column(Date, nullable=True)
    realized_pnl = Column(Float, nullable=True)
    roi_percent = Column(Float, nullable=True)

    # Relationships
    ipo = relationship("Ipo", back_populates="allotments")


class AsbaLock(BaseModel):
    __tablename__ = "asba_locks"

    account_id = Column(String(36), ForeignKey("family_accounts.id", ondelete="CASCADE"), nullable=False)
    ipo_id = Column(String(36), ForeignKey("ipos.id", ondelete="CASCADE"), nullable=False)
    
    account_name = Column(String(100), nullable=False)
    ipo_name = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    lock_date = Column(Date, nullable=False)
    release_date = Column(Date, nullable=False)
    
    next_ipo_conflict = Column(String(200), nullable=True)
    is_conflict = Column(Boolean, default=False)
