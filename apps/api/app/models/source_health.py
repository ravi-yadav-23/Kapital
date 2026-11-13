from sqlalchemy import Column, String, Integer, DateTime, Date
from app.models.base import BaseModel


class SourceHealth(BaseModel):
    """One row per data source: when it last worked, why it last failed, and its daily request budget use."""
    __tablename__ = "source_health"

    source = Column(String(50), nullable=False, unique=True, index=True)
    last_attempt_at = Column(DateTime, nullable=True)
    last_success_at = Column(DateTime, nullable=True)
    last_error = Column(String(500), nullable=True)      # "WARNING: ..." for soft problems
    consecutive_failures = Column(Integer, nullable=False, default=0)
    last_record_count = Column(Integer, nullable=False, default=0)
    budget_date = Column(Date, nullable=True)            # day that requests_today belongs to
    requests_today = Column(Integer, nullable=False, default=0)
