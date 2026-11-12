"""F11-F15: a report may only claim what the supplied inputs support; 'not assessed' stays not assessed."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.agents import orchestrator as om
from app.agents.orchestrator import orchestrator
from app.models.ipo import Ipo
from app.models.report import AiReport
from app.utils.scoring import momentum_score

HIST = [{"year": "FY24", "amount_cr": 100.0}, {"year": "FY25", "amount_cr": 130.0}, {"year": "FY26", "amount_cr": 170.0}]
NULL_ANALYSIS = {"financial_quality_score": None, "valuation_safety_score": None, "data_sufficiency": "partial",
                 "revenue_history": HIST, "pat_history": HIST, "cfo_history": HIST, "cfo_to_pat_ratio": 1.2,
                 "revenue_growth_yoy": "+30% YoY", "pat_growth_yoy": "+40% YoY",
                 "pe_ratio": 24.5, "peer_avg_pe": 32.0, "ofs_percentage": 25.0, "litigation_claims_cr": 2.0,
                 "analyst_verdict": "x" * 80}
NULL_NEWS = {"promoter_integrity_score": None, "industry_tailwinds_score": None, "data_sufficiency": "none",
             "anchor_quality_verdict": "Not assessed (no verified anchor disclosures in input)",
             "sentiment_summary": "y" * 80}


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(Ipo(id="ai-ipo", symbol="AIH", name="Honest Ltd", slug="honest", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  gmp_percent=20.0, subscription_qib=0.0, rhp_url="https://example.invalid/rhp.pdf",
                  issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2)))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(AiReport).where(AiReport.ipo_id == "ai-ipo"))
        await s.execute(delete(Ipo).where(Ipo.id == "ai-ipo"))
        await s.commit()


async def _run(db, analysis, news):
    with patch.object(om.analysis_agent, "analyze", new=AsyncMock(return_value=analysis)), \
         patch.object(om.news_agent, "analyze", new=AsyncMock(return_value=news)), \
         patch.object(om.allocation_agent, "strategize",
                      new=AsyncMock(return_value={"recommended_primary_category": "RETAIL"})):
        return await orchestrator.run_full_due_diligence(db, "ai-ipo")


@pytest.mark.asyncio
async def test_null_model_scores_stay_null_and_do_not_enter_the_score(db):
    rep = await _run(db, NULL_ANALYSIS, NULL_NEWS)
    sb = rep.score_breakdown
    assert (sb.financial_quality, sb.valuation_safety, sb.promoter_integrity, sb.industry_tailwinds) == (None,) * 4
    # nothing assessed by the model -> preliminary market-signal score from the single shared formula:
    # GMP 20% -> 60, and no subscription data yet, so GMP alone (no invented default for missing data)
    assert rep.overall_score == momentum_score(20.0, 0.0, 0.0) == 60
    assert rep.recommendation == "PENDING"


@pytest.mark.asyncio
async def test_report_with_no_model_scores_is_not_labelled_audited(db):
    rep = await _run(db, NULL_ANALYSIS, NULL_NEWS)
    assert rep.is_audited is False


@pytest.mark.asyncio
async def test_financials_returned_by_model_are_not_accepted_as_data(db):
    """Agents receive no financial statements, so any series the model returns is invention."""
    rep = await _run(db, NULL_ANALYSIS, NULL_NEWS)
    assert rep.data_sufficiency != "full"
    assert rep.financial_metrics is None
    assert rep.executive_summary.startswith("[AI summary from limited inputs]")


@pytest.mark.asyncio
async def test_filed_prospectus_is_reported_as_filed_and_figures_stay_unassessed(db):
    rep = await _run(db, NULL_ANALYSIS, NULL_NEWS)
    assert rep.drhp_status == "FILED"
    assert rep.pe_ratio is None and rep.peer_avg_pe is None and rep.ofs_percentage is None
    blob = " ".join(f"{g.details} {g.impact}" for g in rep.gatekeepers)
    assert "not yet filed" not in blob.lower()
    assert "HDFC" not in blob and "Nippon" not in blob
    assert all(g.status == "WARN" for g in rep.gatekeepers)


@pytest.mark.asyncio
async def test_model_scores_that_are_present_are_used(db):
    analysis = dict(NULL_ANALYSIS, financial_quality_score=80, valuation_safety_score=60)
    news = dict(NULL_NEWS, promoter_integrity_score=70, industry_tailwinds_score=90)
    rep = await _run(db, analysis, news)
    assert rep.is_audited is True
    assert rep.score_breakdown.financial_quality == 80
    # components without data (subscription) are left out and the remaining weights renormalised
    assert rep.overall_score == round((80 * .25 + 60 * .20 + 60 * .20 + 70 * .15 + 90 * .10) / 0.90)


def test_weighted_score_renormalises_over_available_components():
    full = orchestrator.compute_weighted_score(80, 90, 50, 60, 40, 70, 0)
    assert full == round(80 * .25 + 60 * .20 + 40 * .20 + 70 * .15 + 90 * .10 + 50 * .10)
    partial = orchestrator.compute_weighted_score(None, None, 50, None, 40, None, 0)
    assert partial == round((40 * .20 + 50 * .10) / .30)
