from sqlalchemy import Column, String, Float, Date, UniqueConstraint
from app.models.base import BaseModel

# Append-only observations. Deliberately NO foreign key / cascade to `ipos`: they are never deleted.


class GmpSnapshot(BaseModel):
    """One GMP observation per IPO, day and source (a same-day re-run updates it)."""
    __tablename__ = "gmp_snapshots"
    __table_args__ = (UniqueConstraint("ipo_id", "snapshot_date", "source", name="uq_gmp_snapshot"),)

    ipo_id = Column(String(36), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)
    source = Column(String(50), nullable=False)
    gmp_percent = Column(Float, nullable=False)
    gmp_rupees = Column(Float, nullable=True)


class SubscriptionSnapshot(BaseModel):
    """One subscription observation (times subscribed) per IPO, day and source."""
    __tablename__ = "subscription_snapshots"
    __table_args__ = (UniqueConstraint("ipo_id", "snapshot_date", "source", name="uq_subscription_snapshot"),)

    ipo_id = Column(String(36), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)
    source = Column(String(50), nullable=False)
    retail = Column(Float, nullable=True)
    shni = Column(Float, nullable=True)
    bhni = Column(Float, nullable=True)
    qib = Column(Float, nullable=True)
    total = Column(Float, nullable=True)


class IpoOutcome(BaseModel):
    """What actually happened on listing day: the ground truth the scoring engine is calibrated against."""
    __tablename__ = "ipo_outcomes"

    ipo_id = Column(String(36), nullable=False, unique=True, index=True)
    symbol = Column(String(50), nullable=True)
    issue_price = Column(Float, nullable=True)
    listing_price = Column(Float, nullable=False)
    listing_gain_percent = Column(Float, nullable=False)
    listing_date = Column(Date, nullable=True)
    is_sme = Column(String(5), nullable=True)           # "true" / "false"
    last_gmp_percent = Column(Float, nullable=True)      # latest quote seen before listing
    last_subscription_total = Column(Float, nullable=True)
    source = Column(String(50), nullable=False)
