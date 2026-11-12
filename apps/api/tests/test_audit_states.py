"""M1: the report endpoint says what really happened, so the UI never claims an audit that did not run."""
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.agents import orchestrator as om
from app.db.database import get_db
from app.main import app
from app.middleware.auth import create_access_token
from app.models.base import Base
from app.models.ipo import Ipo
from app.models.report import AiReport

ADMIN = {"Authorization": "Bearer " + create_access_token({"sub": "admin-1", "role": "ADMIN", "is_guest": False})}
GUEST = {"Authorization": "Bearer " + create_access_token({"sub": "g", "role": "GUEST", "is_guest": True})}


@pytest_asyncio.fixture
async def maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    m = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _db():
        async with m() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    async with m() as s:
        s.add(Ipo(id="au-1", symbol="AUD", name="Audit State Ltd", slug="audit-state", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  gmp_percent=20.0, subscription_total=3.0, subscription_qib=1.0))
        await s.commit()
    yield m
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _post(headers):
    async with _client() as c:
        return (await c.post("/api/reports/au-1/generate", headers=headers)).json()


@pytest.mark.asyncio
async def test_guest_without_stored_report_gets_not_run(maker):
    body = await _post(GUEST)
    assert body["audit_state"] == "NOT_RUN"
    assert body["is_audited"] is False
    assert "schedule" in body["audit_note"].lower() or "admin" in body["audit_note"].lower()


@pytest.mark.asyncio
async def test_guest_with_stored_audit_gets_cached(maker):
    async with maker() as s:
        s.add(AiReport(id="r-au", ipo_id="au-1", overall_score=71, recommendation="MODERATE_APPLY",
                       is_audited=True, executive_summary="x", scored_at="12 Nov 2026"))
        await s.commit()
    body = await _post(GUEST)
    assert body["audit_state"] == "CACHED"
    assert body["is_audited"] is True
    assert "12 Nov 2026" in body["audit_note"]


@pytest.mark.asyncio
async def test_admin_without_ai_key_is_preliminary_with_the_reason(maker):
    body = await _post(ADMIN)  # test environment has no LLM key
    assert body["audit_state"] == "PRELIMINARY"
    assert body["is_audited"] is False
    assert "api key" in body["audit_note"].lower()


@pytest.mark.asyncio
async def test_admin_with_working_ai_is_complete(maker):
    analysis = {"financial_quality_score": 80, "valuation_safety_score": 60, "analyst_verdict": "x" * 80,
                "data_sufficiency": "partial"}
    news = {"promoter_integrity_score": 70, "industry_tailwinds_score": 70, "anchor_quality_verdict": "Not assessed",
            "sentiment_summary": "y" * 80, "data_sufficiency": "none"}
    with patch.object(om.analysis_agent, "analyze", new=AsyncMock(return_value=analysis)), \
         patch.object(om.news_agent, "analyze", new=AsyncMock(return_value=news)), \
         patch.object(om.allocation_agent, "strategize", new=AsyncMock(return_value={"recommended_primary_category": "RETAIL"})):
        body = await _post(ADMIN)
    assert body["audit_state"] == "AI_COMPLETE"
    assert body["is_audited"] is True
