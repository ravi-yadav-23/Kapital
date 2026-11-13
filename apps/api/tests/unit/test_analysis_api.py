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


def _result(ipo_id, score=70, verdict="MODERATE_APPLY", day_offset=0):
    from app.models.base import get_utc_now
    return AnalysisResult(ipo_id=ipo_id, version_id="v1", score=score, verdict=verdict, confidence="high",
                          components={"demand": {"value": 80, "weight": 0.5}},
                          signals=[{"code": "demand", "direction": "positive", "reason": "Subscription demand scores 80/100."}],
                          red_flags=[], facts={"net_profit_cr": 10.0}, inputs={"gmp_percent": 20.0},
                          created_at=get_utc_now() - timedelta(days=day_offset))


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _quota(db):
    row = (await db.execute(select(AuditQuota).where(AuditQuota.day == date.today()))).scalar_one_or_none()
    return row.used if row else 0


@pytest.mark.asyncio
async def test_guest_reads_precomputed_analysis_with_badge(db):
    db.add_all([_ipo("AQ1"), _result("id-AQ1", 70, "MODERATE_APPLY")])
    await db.commit()
    async with _client() as c:
        r = await c.get("/api/analysis/id-AQ1")
    body = r.json()
    assert r.status_code == 200 and body["state"] == "ready" and body["badge"] == "APPLY"
    assert body["score"] == 70 and body["signals"][0]["reason"] and body["confidence"] == "high"


@pytest.mark.asyncio
async def test_badge_mapping_and_not_analysed_state(db):
    db.add_all([_ipo("AQ2"), _ipo("AQ3"), _result("id-AQ2", 30, "AVOID")])
    await db.commit()
    async with _client() as c:
        assert (await c.get("/api/analysis/id-AQ2")).json()["badge"] == "AVOID"
        none = (await c.get("/api/analysis/id-AQ3")).json()
        assert none["state"] == "not_analysed" and none["badge"] is None
        assert (await c.get("/api/analysis/does-not-exist")).status_code == 404


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
                _ipo("AQN2", "upcoming", issue_open_date=date.today() + timedelta(days=9), drhp_url="https://www.sebi.gov.in/b.pdf")])
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
async def test_summary_list_has_one_latest_row_per_ipo(db):
    db.add_all([_ipo("AQL1"), _ipo("AQL2"), _result("id-AQL1", 30, "AVOID", day_offset=2),
                _result("id-AQL1", 85, "STRONG_APPLY", day_offset=0), _result("id-AQL2", 50, "WATCH")])
    await db.commit()
    async with _client() as c:
        rows = (await c.get("/api/analysis")).json()
    mine = {r["ipo_id"]: r for r in rows if r["ipo_id"] in ("id-AQL1", "id-AQL2")}
    assert mine["id-AQL1"]["badge"] == "APPLY" and mine["id-AQL1"]["score"] == 85   # newest wins
    assert mine["id-AQL2"]["badge"] == "WATCH"
    assert len([r for r in rows if r["ipo_id"] == "id-AQL1"]) == 1
