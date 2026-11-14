"""Fallback for IPOs whose offer document cannot be found or read: Groww's structured company financials.

Tier 1 offer document (model-read) -> tier 2 Groww summary financials (deterministic, no model) -> tier 3 market data.
The basis of the score is always reported.
"""
import json
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.documents.errors import DocumentError
from app.documents.facts import company_score_from_facts, clean_facts
from app.jobs.nightly import run_nightly
from app.models.analysis import AnalysisChunk, AnalysisResult, AnalysisVersion
from app.models.ipo import Ipo
from app.services.rating import rate
from app.sources.groww import parse_groww_summary
from tests.unit.test_documents_pipeline import make_pdf


def _page(financials, doc=None):
    data = {"props": {"pageProps": {"ipoData": {"financials": financials, "documentUrl": doc}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'


def _fin(revenue, profit, assets=None, years=("2022", "2023", "2024")):
    rows = [{"title": "Revenue", "yearly": dict(zip(years, revenue)), "quarterly": {}},
            {"title": "Profit", "yearly": dict(zip(years, profit)), "quarterly": {}}]
    if assets:
        rows.append({"title": "Total Assets", "yearly": dict(zip(years, assets)), "quarterly": {}})
    return rows


def test_summary_facts_are_derived_from_the_latest_two_years():
    out = parse_groww_summary(_page(_fin([4738.65, 6401.59, 8290.9], [-191.9, 479.95, 637.05])))
    f = out["facts"]
    assert f["net_profit_cr"] == 637.05
    assert round(f["revenue_growth_pct"], 1) == round((8290.9 / 6401.59 - 1) * 100, 1)
    assert round(f["net_margin_pct"], 1) == round(637.05 / 8290.9 * 100, 1)
    assert out["years"] == ["2023", "2024"]


def test_a_loss_is_reported_as_a_negative_profit():
    f = parse_groww_summary(_page(_fin([100.0, 120.0, 150.0], [5.0, -3.0, -9.0])))["facts"]
    assert f["net_profit_cr"] == -9.0 and f["net_margin_pct"] < 0


def test_missing_or_unusable_financials_give_nothing():
    assert parse_groww_summary("<html>no data</html>") is None
    assert parse_groww_summary(_page([])) is None
    assert parse_groww_summary(_page(None)) is None
    assert parse_groww_summary(_page(_fin([0, 0, 0], [1, 1, 1]))) is None            # no revenue base
    assert parse_groww_summary(_page([{"title": "Profit", "yearly": {"2024": "n/a"}, "quarterly": {}}])) is None


def test_summary_only_scores_are_capped_and_say_what_they_are_based_on():
    facts = dict(clean_facts({"net_profit_cr": 300.0, "revenue_growth_pct": 40.0, "net_margin_pct": 25.0}),
                 facts_basis="groww_summary")
    assert company_score_from_facts(facts) is not None                           # three facts are enough to score
    assert company_score_from_facts(facts, limited=True) <= 70                    # but never as high as a full reading
    r = rate({"gmp_percent": 20.0, "subscription_total": 5.0, "name": "Plain Ltd"}, facts)
    assert r["facts_basis"] == "groww_summary" and r["documents_analysed"] is False
    full = rate({"gmp_percent": 20.0, "subscription_total": 5.0, "name": "Plain Ltd"},
                dict(net_profit_cr=300.0, revenue_growth_pct=40.0, debt_to_equity=0.3, promoter_holding_post_pct=70.0))
    assert full["facts_basis"] == "offer_document" and full["documents_analysed"] is True


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        for m in (AnalysisResult, AnalysisChunk, AnalysisVersion):
            await s.execute(delete(m))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("FBK%")))
        await s.commit()


def _ipo(symbol, **kw):
    d = date.today()
    base = dict(id=f"id-{symbol}", symbol=symbol, name=f"{symbol} Ltd", slug=f"{symbol.lower()}-ipo", type="EQ",
                status="open", price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=d, issue_close_date=d + timedelta(days=2), gmp_percent=20.0, subscription_total=5.0)
    base.update(kw)
    return Ipo(**base)


SUMMARY = {"facts": {"net_profit_cr": 40.0, "revenue_growth_pct": 30.0, "net_margin_pct": 12.0},
           "url": "https://groww.in/ipo/fbk1-ipo", "years": ["2023", "2024"]}


async def _noop_extractor(text):
    return {}


@pytest.mark.asyncio
async def test_no_document_link_falls_back_to_the_summary_and_marks_the_basis(db):
    db.add(_ipo("FBK1"))
    await db.commit()
    asked = []

    async def summary_finder(ipo):
        if ipo.symbol != "FBK1":
            return None
        asked.append(ipo.slug)
        return SUMMARY

    out = await run_nightly(db, extractor=_noop_extractor, summary_finder=summary_finder, max_chunks=5)
    res = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-FBK1"))).scalar_one()
    assert asked == ["fbk1-ipo"] and out["summary_fallbacks"] >= 1
    assert res.facts["facts_basis"] == "groww_summary" and res.facts["net_profit_cr"] == 40.0
    ver = (await db.execute(select(AnalysisVersion).where(AnalysisVersion.ipo_id == "id-FBK1"))).scalar_one()
    assert ver.doc_kind == "SUMMARY" and ver.doc_url.startswith("https://groww.in/")


@pytest.mark.asyncio
async def test_a_failed_document_download_also_falls_back(db):
    db.add(_ipo("FBK2", rhp_url="https://www.sebi.gov.in/slow.pdf"))
    await db.commit()

    async def fetcher(url):
        raise DocumentError("network error: ReadTimeout")

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "FBK2" else None

    await run_nightly(db, extractor=_noop_extractor, fetcher=fetcher, summary_finder=summary_finder, max_chunks=5)
    res = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-FBK2"))).scalar_one()
    assert res.facts["facts_basis"] == "groww_summary"


@pytest.mark.asyncio
async def test_a_real_document_replaces_the_summary_and_the_summary_is_kept(db):
    db.add(_ipo("FBK3"))
    await db.commit()

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "FBK3" else None

    await run_nightly(db, extractor=_noop_extractor, summary_finder=summary_finder, max_chunks=5)
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "FBK3"))).scalar_one()
    ipo.rhp_url = "https://www.sebi.gov.in/ok.pdf"                      # the document is found later
    await db.commit()

    async def fetcher(url):
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0, "revenue_growth_pct": 20.0, "debt_to_equity": 0.5, "promoter_holding_post_pct": 70.0}

    await run_nightly(db, extractor=extractor, fetcher=fetcher, summary_finder=summary_finder, max_chunks=30,
                      chunk_chars=40, chunk_overlap=0)
    rows = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-FBK3")
                             .order_by(AnalysisResult.created_at, AnalysisResult.id))).scalars().all()
    assert len(rows) == 2                                               # history kept
    assert rows[0].facts["facts_basis"] == "groww_summary"
    assert "facts_basis" not in rows[-1].facts and rows[-1].facts["debt_to_equity"] == 0.5   # newest = document


@pytest.mark.asyncio
async def test_ipos_with_nothing_to_read_do_not_use_up_the_per_night_limit(db):
    """Seen live: TEMP placeholder IPOs (no document, no financials anywhere) filled the 'max IPOs' limit every night,
    so IPOs that could be analysed were never reached."""
    d = date.today()
    for i in range(4):                       # open, come first, but have no link and no summary
        db.add(_ipo(f"FBKE{i}", issue_close_date=d + timedelta(days=1)))
    db.add(_ipo("FBKGOOD", status="upcoming", issue_open_date=d + timedelta(days=5), issue_close_date=d + timedelta(days=7),
                slug="fbkgood-ipo"))
    await db.commit()

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "FBKGOOD" else None

    out = await run_nightly(db, extractor=_noop_extractor, summary_finder=summary_finder, max_chunks=5, max_ipos=1)
    got = {r.ipo_id for r in (await db.execute(select(AnalysisResult))).scalars().all()}
    assert "id-FBKGOOD" in got and out["skipped_no_document"] >= 4


@pytest.mark.asyncio
async def test_upcoming_order_rotates_daily_but_open_ipos_stay_first(db):
    from app.jobs.nightly import _candidates
    d = date.today()
    db.add_all([_ipo(f"FBKR{i}", status="upcoming", issue_open_date=d + timedelta(days=3), issue_close_date=d + timedelta(days=5))
                for i in range(6)] + [_ipo("FBKOPEN")])
    await db.commit()
    first = [i.symbol for i in await _candidates(db, 80) if i.symbol.startswith("FBK")]
    assert first[0] == "FBKOPEN"                                       # open before upcoming
    assert sorted(first[1:]) == [f"FBKR{i}" for i in range(6)]


@pytest.mark.asyncio
async def test_a_deferred_document_gets_a_provisional_summary_score(db):
    """The IPO has a document link, but tonight's chunk budget is already used: score it from the summary for now."""
    db.add(_ipo("FBK4", rhp_url="https://www.sebi.gov.in/later.pdf"))
    await db.commit()
    fetched = []

    async def fetcher(url):
        fetched.append(url)
        return make_pdf(["x"])

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "FBK4" else None

    out = await run_nightly(db, extractor=_noop_extractor, fetcher=fetcher, summary_finder=summary_finder, max_chunks=0)
    res = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-FBK4"))).scalar_one()
    assert out["deferred"] >= 1 and out["summary_fallbacks"] >= 1 and fetched == []
    assert res.facts["facts_basis"] == "groww_summary"


@pytest.mark.asyncio
async def test_a_summary_never_overwrites_a_document_based_result(db):
    db.add(_ipo("FBK5", rhp_url="https://www.sebi.gov.in/done.pdf"))
    await db.commit()

    async def fetcher(url):
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0, "revenue_growth_pct": 20.0, "debt_to_equity": 0.5, "promoter_holding_post_pct": 70.0}

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "FBK5" else None

    await run_nightly(db, extractor=extractor, fetcher=fetcher, summary_finder=summary_finder, max_chunks=30,
                      chunk_chars=40, chunk_overlap=0)
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "FBK5"))).scalar_one()
    from app.jobs.nightly import _summary_fallback
    assert await _summary_fallback(db, ipo, summary_finder) is False            # a document result exists
    rows = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-FBK5"))).scalars().all()
    assert len(rows) == 1 and "facts_basis" not in rows[0].facts
