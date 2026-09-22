from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.base import BaseModel

def get_utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class IpoOrder(BaseModel):
    __tablename__ = "ipo_orders"

    account_id = Column(String(36), ForeignKey("family_accounts.id", ondelete="CASCADE"), nullable=False)
    ipo_id = Column(String(36), ForeignKey("ipos.id", ondelete="CASCADE"), nullable=False)
    
    account_name = Column(String(100), nullable=False)
    ipo_name = Column(String(200), nullable=False)
    
    category = Column(String(20), default="RETAIL")  # RETAIL, sHNI, bHNI
    lots = Column(Integer, default=1, nullable=False)
    shares = Column(Integer, nullable=False)
    bid_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    upi_vpa = Column(String(100), nullable=False)
    
    # Angel One Order Execution Details
    angel_order_id = Column(String(100), nullable=True)
    status = Column(String(30), default="PENDING")  # PENDING, SUBMITTED, CONFIRMED, REJECTED, CANCELLED
    reject_reason = Column(String(500), nullable=True)
    mandate_status = Column(String(50), default="AWAITING_APPROVAL")  # AWAITING_APPROVAL, APPROVED, REJECTED
    placed_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Relationships
    ipo = relationship("Ipo", back_populates="orders")
