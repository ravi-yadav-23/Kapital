from sqlalchemy import Column, String, Float, Integer, Date
from datetime import date
from app.models.base import BaseModel


class FundSnapshot(BaseModel):
    """
    Historical record of family corpus balances and ASBA lock utilization.
    Persisted daily during fund audit or upon major capital allocation.
    """
    __tablename__ = "fund_snapshots"

    snapshot_date = Column(Date, default=date.today, nullable=False, index=True)
    total_family_corpus = Column(Float, nullable=False, default=0.0)
    total_available_liquid = Column(Float, nullable=False, default=0.0)
    total_locked_asba = Column(Float, nullable=False, default=0.0)
    utilization_percent = Column(Float, nullable=False, default=0.0)
    active_accounts_count = Column(Integer, default=0)
    total_accounts_count = Column(Integer, default=0)
    notes = Column(String(500), nullable=True)
