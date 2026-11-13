from sqlalchemy import Column, String, Integer, Date, DateTime, UniqueConstraint
from app.models.base import BaseModel


class AuditRequest(BaseModel):
    """A guest's "Run audit" click. It only queues work for the nightly job; no model is called on request."""
    __tablename__ = "audit_requests"
    __table_args__ = (UniqueConstraint("ipo_id", "request_date", name="uq_audit_request_day"),)

    ipo_id = Column(String(36), nullable=False, index=True)
    request_date = Column(Date, nullable=False)
    status = Column(String(10), nullable=False, default="queued")   # queued | done
    completed_at = Column(DateTime, nullable=True)


class AuditQuota(BaseModel):
    """Clicks used per day across ALL guests. Incremented with a conditional UPDATE so the cap cannot be overshot."""
    __tablename__ = "audit_quota"

    day = Column(Date, nullable=False, unique=True)
    used = Column(Integer, nullable=False, default=0)
