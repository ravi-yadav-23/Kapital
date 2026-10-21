import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.analysis_agent import analysis_agent
from app.agents.news_agent import news_agent
from app.agents.allocation_agent import allocation_agent
from app.agents.orchestrator import orchestrator


@pytest.mark.asyncio
async def test_analysis_agent_fallback(db_session: AsyncSession, seed_data):
    res = await analysis_agent.analyze(db_session, "ipo-test-1")
    assert "financial_quality_score" in res
    assert "valuation_safety_score" in res
    assert res["financial_quality_score"] > 0


@pytest.mark.asyncio
async def test_news_agent_fallback(db_session: AsyncSession, seed_data):
    res = await news_agent.analyze(db_session, "ipo-test-1")
    assert "promoter_integrity_score" in res
    assert "market_buzz_rating" in res


@pytest.mark.asyncio
async def test_allocation_agent_fallback(db_session: AsyncSession, seed_data):
    res = await allocation_agent.strategize(db_session, "ipo-test-1")
    assert "recommended_primary_category" in res
    assert res["recommended_primary_category"] in ["RETAIL", "sHNI", "bHNI"]


@pytest.mark.asyncio
async def test_orchestrator_due_diligence(db_session: AsyncSession, seed_data):
    report = await orchestrator.run_full_due_diligence(db_session, "ipo-test-1")
    assert 0 < report.overall_score <= 100
    assert report.recommendation in ["STRONG_APPLY", "MODERATE_APPLY", "WATCH", "AVOID", "PENDING"]
    assert report.score_breakdown.financial_quality > 0
    assert report.summary_source in ["ai_generated", "template_fallback", "sector_fallback"]
