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
    from unittest.mock import patch

    mock_analysis = {
        "financial_quality_score": 82,
        "valuation_safety_score": 75,
        "strengths_summary": ["Robust revenue growth", "High cash conversion"],
        "concerns_summary": ["Working capital intensity"],
        "accounting_red_flags": [],
        "fair_value_estimate_inr": 210.0,
        "pe_ratio": 24.5,
        "peer_avg_pe": 32.0,
        "ofs_percentage": 25.0,
        "litigation_claims_cr": 0.0,
        "revenue_growth_yoy": "+28.4% YoY",
        "revenue_history": [],
        "pat_growth_yoy": "+31.2% YoY",
        "pat_history": [],
        "cfo_history": [],
        "cfo_to_pat_ratio": 1.15,
        "growth_demand_verdict": "Strong institutional interest expected.",
        "analyst_verdict": "Attractive listing gain candidate.",
        "data_sufficiency": "partial",
    }
    mock_news = {
        "promoter_integrity_score": 85,
        "industry_tailwinds_score": 80,
        "market_buzz_rating": "HIGH",
        "governance_flags": [],
        "anchor_quality_verdict": "Anchor backing from leading domestic mutual funds.",
        "sentiment_summary": "Positive market sentiment with healthy GMP premium.",
    }

    async def _mock_call_llm(self, system_instruction, user_prompt, ai_cfg):
        if "Equity Research" in system_instruction:
            return mock_analysis
        return mock_news

    with patch("app.agents.base.BaseAgent.call_llm", side_effect=_mock_call_llm, autospec=True):
        report = await orchestrator.run_full_due_diligence(db_session, "ipo-test-1")

    assert 0 < report.overall_score <= 100
    assert report.recommendation in ["STRONG_APPLY", "MODERATE_APPLY", "WATCH", "AVOID", "PENDING"]
    assert report.score_breakdown.financial_quality > 0
    assert report.summary_source in ["ai_generated", "template_fallback", "sector_fallback"]
