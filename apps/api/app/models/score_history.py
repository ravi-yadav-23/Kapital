from sqlalchemy import Column, String, Integer, JSON
from app.models.base import BaseModel


class ScoreHistory(BaseModel):
    """Append-only log of every change of an IPO's score, with the reason.

    Deliberately has NO foreign key / cascade to `ipos`: history is never deleted, even if an IPO row is.
    """
    __tablename__ = "score_history"

    ipo_id = Column(String(36), nullable=False, index=True)
    component = Column(String(30), nullable=False)  # momentum | overall
    value = Column(Integer, nullable=True)           # None == "no score yet"
    recommendation = Column(String(30), nullable=True)
    reason = Column(String(500), nullable=True)
    inputs = Column(JSON, nullable=True)
