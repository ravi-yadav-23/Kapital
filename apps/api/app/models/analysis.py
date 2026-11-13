from sqlalchemy import Column, String, Integer, JSON, Text, UniqueConstraint
from app.models.base import BaseModel

# Append-only: no foreign keys / cascades, rows are never deleted. A changed document is a NEW version.


class AnalysisVersion(BaseModel):
    """One stored copy of an offer document (DRHP/RHP) for an IPO."""
    __tablename__ = "analysis_versions"
    __table_args__ = (UniqueConstraint("ipo_id", "doc_kind", "version", name="uq_analysis_version"),)

    ipo_id = Column(String(36), nullable=False, index=True)
    doc_kind = Column(String(20), nullable=False)       # DRHP | RHP | OTHER
    doc_url = Column(String(500), nullable=False)
    doc_sha256 = Column(String(64), nullable=False)
    version = Column(Integer, nullable=False)
    model = Column(String(80), nullable=True)


class AnalysisResult(BaseModel):
    """Listing-gain engine output for one IPO on one night (append-only history; latest row is current)."""
    __tablename__ = "analysis_results"

    ipo_id = Column(String(36), nullable=False, index=True)
    version_id = Column(String(36), nullable=False, index=True)
    score = Column(Integer, nullable=True)
    verdict = Column(String(30), nullable=False)
    confidence = Column(String(10), nullable=False)
    components = Column(JSON, nullable=True)
    signals = Column(JSON, nullable=True)
    red_flags = Column(JSON, nullable=True)
    facts = Column(JSON, nullable=True)
    inputs = Column(JSON, nullable=True)       # the GMP / subscription numbers used that night


class AnalysisChunk(BaseModel):
    """One chunk of a document version and what the model extracted from it."""
    __tablename__ = "analysis_chunks"
    __table_args__ = (UniqueConstraint("version_id", "chunk_index", name="uq_analysis_chunk"),)

    ipo_id = Column(String(36), nullable=False, index=True)
    version_id = Column(String(36), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_start = Column(Integer, nullable=True)
    page_end = Column(Integer, nullable=True)
    text_sha256 = Column(String(64), nullable=False)
    text = Column(Text, nullable=False)
    status = Column(String(10), nullable=False, default="pending")   # pending | done | failed
    facts = Column(JSON, nullable=True)
    error = Column(String(300), nullable=True)
