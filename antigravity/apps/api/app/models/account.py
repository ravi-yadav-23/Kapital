from sqlalchemy import Column, String, Float, Boolean, Integer
from app.models.base import BaseModel

class FamilyAccount(BaseModel):
    __tablename__ = "family_accounts"

    name = Column(String(100), nullable=False)
    relation = Column(String(50), nullable=False)  # Self, Father, Mother, Sister, Brother, Spouse
    angel_client_id = Column(String(50), unique=True, nullable=False)
    angel_api_key = Column(String(255), nullable=True)
    totp_secret = Column(String(255), nullable=True)
    pin = Column(String(255), nullable=True)
    
    # Financial metrics
    total_demat_balance = Column(Float, default=0.0, nullable=False)
    available_liquid_balance = Column(Float, default=0.0, nullable=False)
    locked_asba_balance = Column(Float, default=0.0, nullable=False)
    
    # Performance tracking
    total_bids_placed = Column(Integer, default=0, nullable=False)
    total_allotments_won = Column(Integer, default=0, nullable=False)
    total_realized_pnl = Column(Float, default=0.0, nullable=False)
    
    # Preferences & Flags
    default_category_preference = Column(String(20), default="RETAIL")  # RETAIL, sHNI, bHNI
    is_active = Column(Boolean, default=True, nullable=False)
