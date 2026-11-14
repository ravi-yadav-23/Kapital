"""M1 contract: the same IPO has the same score and verdict on every endpoint and in the optimizer."""
from datetime import date, timedelta
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import app
from app.models.ipo import Ipo
from app.models.report import AiReport
from app.services.rating import rate
from app.utils.scoring import recommendation_for

IDS = ["sc-a", "sc-b", "sc-c"]


@pytest_asyncio.fixture
async def seeded(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    common = dict(type="EQ", price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2),
                  listing_date=date.today() + timedelta(days=6))
    async with maker() as s:
        # A: live market data, STALE stored score that must be ignored
        s.add(Ipo(id="sc-a", symbol="SCA", name="Alpha Contract Ltd", slug="alpha-contract", status="open",
                  gmp_percent=20.0, subscription_qib=1.0, subscription_total=3.0, score=99,
                  recommendation="STRONG_APPLY", **common))
        # B: no market data at all, stale placeholder score 27 must not be shown
        s.add(Ipo(id="sc-b", symbol="SCB", name="Bravo Contract Ltd", slug="bravo-contract", status="upcoming",
                  gmp_percent=0.0, subscription_total=0.0, score=27, recommendation="AVOID", **common))
        # C: audited report exists; live GMP must not change its score
        s.add(Ipo(id="sc-c", symbol="SCC", name="Charlie Contract Ltd", slug="charlie-contract", status="open",
                  gmp_percent=40.0, subscription_qib=5.0, subscription_total=6.0, score=12, **common))
        await s.flush()
        s.add(AiReport(id="rep-sc-c", ipo_id="sc-c", overall_score=71, recommendation="MODERATE_APPLY",
                       is_audited=True, executive_summary="x", score_gmp_strength=80,
                       score_subscription_momentum=60, score_financial_quality=70, score_valuation_safety=70,
                       score_promoter_integrity=70, score_industry_tailwinds=70))
        await s.commit()
    yield
    async with maker() as s:
        await s.execute(delete(AiReport).where(AiReport.ipo_id.in_(IDS)))
        await s.execute(delete(Ipo).where(Ipo.id.in_(IDS)))
        await s.commit()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_every_endpoint_agrees_on_score_and_verdict(seeded):
    async with _client() as c:
        ipos = {i["id"]: i for i in (await c.get("/api/ipos?status=all")).json()}
        reports = {r["ipo_id"]: r for r in (await c.get("/api/reports")).json()}
        single = {i: (await c.get(f"/api/reports/{i}")).json() for i in IDS}

    expected_a = rate(dict(gmp_percent=20.0, subscription_qib=1.0, subscription_total=3.0, name="Alpha Contract Ltd"))["score"]
    assert expected_a == 51     # engine: GMP 20% + demand 3x / QIB 1x (the old formula gave 56)
    for source in (
        ipos["sc-a"]["score"], reports["sc-a"]["overall_score"], single["sc-a"]["overall_score"]
    ):
        assert source == expected_a
    for rec in (ipos["sc-a"]["recommendation"], reports["sc-a"]["recommendation"], single["sc-a"]["recommendation"]):
        assert rec == recommendation_for(expected_a)

    # B: no data -> no score anywhere, never a placeholder
    for source in (ipos["sc-b"]["score"], reports["sc-b"]["overall_score"], single["sc-b"]["overall_score"]):
        assert source is None
    for rec in (ipos["sc-b"]["recommendation"], reports["sc-b"]["recommendation"], single["sc-b"]["recommendation"]):
        assert rec == "PENDING"

    # C: an old audited report (71) no longer decides: the engine score is identical everywhere
    expected_c = rate(dict(gmp_percent=40.0, subscription_qib=5.0, subscription_total=6.0, name="Charlie Contract Ltd"))["score"]
    assert expected_c != 71
    for source in (ipos["sc-c"]["score"], reports["sc-c"]["overall_score"], single["sc-c"]["overall_score"]):
        assert source == expected_c


@pytest.mark.asyncio
async def test_optimizer_receives_the_same_scores(seeded):
    captured = {}

    def fake_solve(accounts, ipos, **kw):
        captured["ipos"] = {i["id"]: i for i in ipos}
        from app.schemas.fund import AllocationPlanResponse
        return AllocationPlanResponse(plan_id="p", generated_at="2026-01-01T00:00:00+00:00",
                                      total_capital_deployed=0.0, entries=[], status="NO_ACTIVE_ISSUES",
                                      asba_lock_overlaps_detected=0)

    with patch("app.routers.funds.AllocationOptimizer.solve_allocation", side_effect=fake_solve):
        async with _client() as c:
            assert (await c.post("/api/funds/optimize")).status_code == 200
    assert captured["ipos"]["sc-a"]["score"] == 51
    assert captured["ipos"]["sc-b"]["score"] is None
    expected_c = rate(dict(gmp_percent=40.0, subscription_qib=5.0, subscription_total=6.0, name="Charlie Contract Ltd"))["score"]
    assert captured["ipos"]["sc-c"]["score"] == expected_c
