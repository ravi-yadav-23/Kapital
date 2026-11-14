"""M9: guests read precomputed analyses and request audits; global daily cap is enforced by the database."""
import asyncio
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.config import settings
from app.jobs.nightly import run_nightly
from app.main import app
from app.models.analysis import AnalysisResult, AnalysisChunk, AnalysisVersion
from app.models.audit_queue import AuditRequest, AuditQuota
from app.models.ipo import Ipo
from tests.unit.test_documents_pipeline import make_pdf


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    async def _none():
        return None
    monkeypatch.setattr("app.middleware.rate_limit.get_redis_pool", _none)


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        for m in (AuditRequest, AuditQuota, AnalysisResult, AnalysisChunk, AnalysisVersion):
            await s.execute(delete(m))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("AQ%")))
        await s.commit()


def _ipo(symbol, status="open", **kw):
    d = date.today()
    base = dict(id=f"id-{symbol}", symbol=symbol, name=f"{symbol} Ltd", slug=symbol.lower(), type="EQ", status=status,
                price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=d, issue_close_date=d + timedelta(days=2), gmp_percent=20.0, subscription_total=5.0)
    base.update(kw)
    return Ipo(**base)


GOOD = dict(net_profit_cr=90.0, revenue_growth_pct=30.0, debt_to_equity=0.4, promoter_holding_post_pct=70.0)
BAD = dict(net_profit_cr=-40.0, revenue_growth_pct=-5.0, debt_to_equity=4.0, promoter_holding_post_pct=15.0,
           operating_cash_flow_cr=-30.0)
QUOTE = "SEBI passed an order against our Promoter on 12 March 2024 imposing a penalty."
VETO = dict(GOOD, regulatory_action_against_promoter=True, regulatory_action_evidence=QUOTE)


def _result(ipo_id, facts=None, day_offset=0, score=1, verdict="WATCH"):
    """A stored nightly result. Its facts matter; the score fields are history only (the shown score is live)."""
    from app.models.base import get_utc_now
    return AnalysisResult(ipo_id=ipo_id, version_id="v1", score=score, verdict=verdict, confidence="high",
                          components={}, signals=[], red_flags=[], facts=facts if facts is not None else GOOD,
                          inputs={"gmp_percent": 20.0},
                          created_at=get_utc_now() - timedelta(days=day_offset))


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _quota(db):
    row = (await db.execute(select(AuditQuota).where(AuditQuota.day == date.today()))).scalar_one_or_none()
    return row.used if row else 0


@pytest.mark.asyncio
async def test_guest_reads_the_analysis_with_the_same_score_as_the_ipo_list(db):
    from app.services.rating import rate
    db.add_all([_ipo("AQ1"), _result("id-AQ1", GOOD)])
    await db.commit()
    async with _client() as c:
        body = (await c.get("/api/analysis/id-AQ1")).json()
        listed = {i["id"]: i for i in (await c.get("/api/ipos?status=all")).json()}["id-AQ1"]
    expected = rate(dict(gmp_percent=20.0, subscription_total=5.0, name="AQ1 Ltd"), GOOD)
    assert body["state"] == "ready" and body["documents_analysed"] is True
    assert body["score"] == expected["score"] == listed["score"]          # one score everywhere
    assert body["badge"] == "APPLY" and body["signals"] and all(s["reason"] for s in body["signals"])


@pytest.mark.asyncio
async def test_verified_critical_flag_gives_avoid_and_market_only_state_is_reported(db):
    db.add_all([_ipo("AQ2"), _ipo("AQ3"), _ipo("AQ3B", gmp_percent=0.0, subscription_total=0.0),
                _result("id-AQ2", VETO)])
    await db.commit()
    async with _client() as c:
        veto = (await c.get("/api/analysis/id-AQ2")).json()
        market = (await c.get("/api/analysis/id-AQ3")).json()
        empty = (await c.get("/api/analysis/id-AQ3B")).json()
        assert (await c.get("/api/analysis/does-not-exist")).status_code == 404
    assert veto["badge"] == "AVOID" and veto["score"] <= 35
    assert any(QUOTE in f["reason"] for f in veto["red_flags"])            # the reader sees the quoted evidence
    assert market["state"] == "market_only" and market["score"] is not None and market["documents_analysed"] is False
    assert empty["state"] == "not_analysed" and empty["score"] is None and empty["badge"] is None


@pytest.mark.asyncio
async def test_cache_hit_is_free_and_never_queues(db):
    db.add_all([_ipo("AQ4"), _result("id-AQ4")])
    await db.commit()
    async with _client() as c:
        r = await c.post("/api/analysis/id-AQ4/request")
    assert r.status_code == 200 and r.json()["state"] == "cached"
    assert await _quota(db) == 0
    assert (await db.execute(select(AuditRequest))).scalars().all() == []


@pytest.mark.asyncio
async def test_stale_analysis_is_queued_and_costs_one_click_once(db):
    db.add_all([_ipo("AQ5"), _result("id-AQ5", day_offset=3)])
    await db.commit()
    async with _client() as c:
        first = await c.post("/api/analysis/id-AQ5/request")
        again = await c.post("/api/analysis/id-AQ5/request")
    assert first.json()["state"] == "queued" and again.json()["state"] == "already_queued"
    assert await _quota(db) == 1


@pytest.mark.asyncio
async def test_global_daily_cap_blocks_further_requests(db, monkeypatch):
    monkeypatch.setattr(settings, "audit_daily_cap", 2)
    db.add_all([_ipo("AQ6"), _ipo("AQ7"), _ipo("AQ8")])
    await db.commit()
    async with _client() as c:
        assert (await c.post("/api/analysis/id-AQ6/request")).status_code == 200
        assert (await c.post("/api/analysis/id-AQ7/request")).status_code == 200
        blocked = await c.post("/api/analysis/id-AQ8/request")
    assert blocked.status_code == 429 and "limit" in blocked.json()["detail"].lower()
    assert await _quota(db) == 2
    assert len((await db.execute(select(AuditRequest))).scalars().all()) == 2   # the refused one left no row


@pytest.mark.asyncio
async def test_cap_holds_across_many_distinct_ipos(db, monkeypatch):
    monkeypatch.setattr(settings, "audit_daily_cap", 3)
    db.add_all([_ipo(f"AQC{i}") for i in range(8)])
    await db.commit()
    codes = []
    async with _client() as c:
        for i in range(8):
            codes.append((await c.post(f"/api/analysis/id-AQC{i}/request")).status_code)
    assert codes.count(200) == 3 and codes.count(429) == 5
    assert await _quota(db) == 3


@pytest.mark.asyncio
async def test_request_never_calls_an_llm(db):
    db.add(_ipo("AQ9"))
    await db.commit()
    with patch("app.agents.base.BaseAgent.call_llm", new=AsyncMock(side_effect=AssertionError("LLM must not run"))):
        async with _client() as c:
            assert (await c.post("/api/analysis/id-AQ9/request")).status_code == 200


@pytest.mark.asyncio
async def test_nightly_job_serves_requested_ipos_first_and_marks_them_done(db):
    db.add_all([_ipo("AQN1", issue_close_date=date.today() + timedelta(days=1), rhp_url="https://www.sebi.gov.in/a.pdf"),
                _ipo("AQN2", "upcoming", issue_open_date=date.today() + timedelta(days=9), issue_close_date=date.today() + timedelta(days=11), drhp_url="https://www.sebi.gov.in/b.pdf")])
    await db.commit()
    async with _client() as c:
        assert (await c.post("/api/analysis/id-AQN2/request")).json()["state"] == "queued"
    urls = []

    async def fetcher(url):
        urls.append(url)
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0, "revenue_growth_pct": 20.0, "debt_to_equity": 0.5}

    await run_nightly(db, extractor=extractor, fetcher=fetcher, max_chunks=20)
    assert urls[0] == "https://www.sebi.gov.in/b.pdf"            # the requested upcoming IPO jumps the queue
    req = (await db.execute(select(AuditRequest).where(AuditRequest.ipo_id == "id-AQN2"))).scalar_one()
    assert req.status == "done"


@pytest.mark.asyncio
async def test_summary_list_uses_the_newest_stored_facts_and_the_live_score(db):
    db.add_all([_ipo("AQL1"), _ipo("AQL2"), _ipo("AQL3", gmp_percent=0.0, subscription_total=0.0),
                _result("id-AQL1", BAD, day_offset=2), _result("id-AQL1", GOOD, day_offset=0), _result("id-AQL2", VETO)])
    await db.commit()
    async with _client() as c:
        rows = (await c.get("/api/analysis")).json()
    mine = {r["ipo_id"]: r for r in rows}
    assert mine["id-AQL1"]["badge"] == "APPLY"                 # the newest (good) facts win over the older bad ones
    assert mine["id-AQL2"]["badge"] == "AVOID"
    assert "id-AQL3" not in mine                              # no data at all -> no score, no badge
    assert len([r for r in rows if r["ipo_id"] == "id-AQL1"]) == 1
