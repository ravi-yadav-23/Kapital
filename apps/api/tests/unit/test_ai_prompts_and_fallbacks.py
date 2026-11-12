"""F14/F15: prompts must not demand figures the model cannot derive; fallbacks must not invent numbers."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.agents.allocation_agent import allocation_agent
from app.agents.analysis_agent import analysis_agent
from app.agents.prompts import ANALYSIS_AGENT_SYSTEM, NEWS_AGENT_SYSTEM
from app.agents.tools import get_ipo_full_profile
from app.models.ipo import Ipo


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(Ipo(id="pf-ipo", symbol="PFL", name="Prof Ltd", slug="prof", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  drhp_url="https://example.invalid/drhp.pdf"))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(Ipo).where(Ipo.id == "pf-ipo"))
        await s.commit()


@pytest.mark.parametrize("field", ["fair_value_estimate_inr", "pe_ratio", "peer_avg_pe", "ofs_percentage",
                                   "litigation_claims_cr", "financial_quality_score", "valuation_safety_score"])
def test_analysis_prompt_allows_null_for_underivable_figures(field):
    line = next(l for l in ANALYSIS_AGENT_SYSTEM.splitlines() if f'"{field}"' in l)
    assert "null" in line, line


def test_news_prompt_still_allows_null_scores():
    assert "or null" in NEWS_AGENT_SYSTEM


@pytest.mark.asyncio
async def test_profile_exposes_prospectus_urls(db):
    prof = await get_ipo_full_profile(db, "pf-ipo")
    assert prof["drhp_url"] and "rhp_url" in prof


@pytest.mark.asyncio
async def test_analysis_prompt_has_no_unsourced_sector_benchmarks(db):
    captured = {}

    async def fake_llm(system, user, cfg):
        captured["user"] = user
        return {"analysis_failed": True, "error": "x"}

    with patch.object(analysis_agent, "call_llm", new=fake_llm):
        await analysis_agent.analyze(db, "pf-ipo")
    assert "SECTOR BENCHMARKS" not in captured["user"]


@pytest.mark.asyncio
async def test_analysis_fallback_does_not_invent_a_fair_value(db):
    res = await analysis_agent.analyze(db, "pf-ipo")  # no API key in tests -> fallback
    assert res["analysis_failed"] is True
    assert res["fair_value_estimate_inr"] is None


@pytest.mark.asyncio
async def test_allocation_fallback_is_flagged_and_has_no_made_up_score(db):
    res = await allocation_agent.strategize(db, "pf-ipo")
    assert res.get("analysis_failed") is True
    assert res.get("capital_efficiency_score") is None
