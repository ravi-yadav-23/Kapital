"""Open IPOs have no SEBI link: the issuer's own RHP (listed on Groww's IPO page) is found and fetched safely."""
import json
from datetime import date, timedelta
from unittest.mock import patch

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.documents.fetch import DocumentError, fetch_document, is_allowed_url
from app.jobs.nightly import run_nightly
from app.models.analysis import AnalysisChunk, AnalysisResult, AnalysisVersion
from app.models.ipo import Ipo
from app.sources.groww import parse_groww_detail
from tests.unit.test_documents_pipeline import make_pdf


def _page(doc):
    data = {"props": {"pageProps": {"ipoData": {"documentUrl": doc}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'


def test_groww_detail_page_gives_the_document_link():
    assert parse_groww_detail(_page("https://antalalimited.in/wp-content/uploads/RHP.pdf")) == "https://antalalimited.in/wp-content/uploads/RHP.pdf"
    assert parse_groww_detail(_page(None)) is None
    assert parse_groww_detail(_page("javascript:alert(1)")) is None
    assert parse_groww_detail(_page("http://plain.example.com/a.pdf")) is None      # https only
    assert parse_groww_detail("<html>no data</html>") is None


def test_issuer_hosts_need_the_public_ok_flag_and_still_refuse_unsafe_addresses():
    url = "https://antalalimited.in/rhp.pdf"
    assert not is_allowed_url(url)                                   # strict mode: regulators only
    assert is_allowed_url(url, public_ok=True)
    for bad in ("http://antalalimited.in/rhp.pdf", "https://127.0.0.1/a.pdf", "https://10.0.0.5/a.pdf",
                "https://localhost/a.pdf", "https://user:pw@antalalimited.in/a.pdf", "https://antalalimited.in:8443/a.pdf",
                "https://printer.local/a.pdf", "file:///etc/passwd", "https://intranet/a.pdf"):
        assert not is_allowed_url(bad, public_ok=True), bad


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_issuer_pdf_is_fetched_only_if_the_host_resolves_to_public_addresses():
    pdf = make_pdf(["hello"])
    handler = lambda r: httpx.Response(200, content=pdf, headers={"content-type": "application/pdf"})  # noqa: E731
    async with _client(handler) as c:
        with patch("app.documents.fetch._resolves_public", return_value=True):
            assert await fetch_document("https://antalalimited.in/rhp.pdf", client=c, public_ok=True) == pdf
        with patch("app.documents.fetch._resolves_public", return_value=False):
            with pytest.raises(DocumentError):
                await fetch_document("https://antalalimited.in/rhp.pdf", client=c, public_ok=True)
        with pytest.raises(DocumentError):                           # strict mode never reaches an issuer host
            await fetch_document("https://antalalimited.in/rhp.pdf", client=c)


@pytest.mark.asyncio
async def test_a_redirect_to_a_private_address_is_refused():
    def handler(req):
        if req.url.host == "antalalimited.in":
            return httpx.Response(302, headers={"location": "https://169.254.169.254/latest/meta-data"})
        return httpx.Response(200, content=b"secret")
    async with _client(handler) as c:
        with patch("app.documents.fetch._resolves_public", return_value=True):
            with pytest.raises(DocumentError):
                await fetch_document("https://antalalimited.in/rhp.pdf", client=c, public_ok=True)


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        for m in (AnalysisResult, AnalysisChunk, AnalysisVersion):
            await s.execute(delete(m))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("DSC%")))
        await s.commit()


@pytest.mark.asyncio
async def test_nightly_finds_a_missing_link_stores_it_and_analyses(db):
    d = date.today()
    db.add(Ipo(id="id-DSC1", symbol="DSC1", name="DSC1 Ltd", slug="dsc1-ipo", type="EQ", status="open",
               price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
               issue_open_date=d, issue_close_date=d + timedelta(days=2), gmp_percent=20.0, subscription_total=5.0))
    await db.commit()
    asked, fetched = [], []

    async def finder(ipo):
        if ipo.slug != "dsc1-ipo":
            return None                      # leftover rows from other tests must not receive links
        asked.append(ipo.slug)
        return "https://dsc1.example.com/rhp.pdf"

    async def fetcher(url):
        fetched.append(url)
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0, "revenue_growth_pct": 20.0, "debt_to_equity": 0.5}

    await run_nightly(db, extractor=extractor, fetcher=fetcher, link_finder=finder, max_chunks=20)
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "DSC1"))).scalar_one()
    assert asked == ["dsc1-ipo"] and ipo.rhp_url == "https://dsc1.example.com/rhp.pdf" and fetched == [ipo.rhp_url]
    assert (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-DSC1"))).scalar_one()


# ---- IPO Watch pages link the filing on NSE's archive ----
from app.sources.ipowatch import parse_ipowatch_detail  # noqa: E402


def test_ipowatch_detail_prefers_the_final_rhp_and_only_official_hosts():
    html = ('<a href="https://nsearchives.nseindia.com/emerge/corporates/content/Registration_1_DRHPWRL.pdf">DRHP</a>'
            '<a href="https://evil.example.com/steal.pdf">x</a>'
            '<a href="https://nsearchives.nseindia.com/emerge/corporates/content/Prospectus_RHPWRL.pdf">RHP</a>')
    assert parse_ipowatch_detail(html).endswith("Prospectus_RHPWRL.pdf")
    only_draft = '<a href="https://nsearchives.nseindia.com/a/DRHPXYZ.pdf">d</a>'
    assert parse_ipowatch_detail(only_draft).endswith("DRHPXYZ.pdf")
    assert parse_ipowatch_detail('<a href="https://evil.example.com/a.pdf">x</a>') is None
    assert parse_ipowatch_detail("<html></html>") is None


@pytest.mark.asyncio
async def test_a_draft_link_found_for_an_open_ipo_is_stored_as_a_draft(db):
    d = date.today()
    db.add(Ipo(id="id-DSC2", symbol="DSC2", name="DSC2 Ltd", slug="dsc2-ipo-details", type="SME", status="open",
               price_band_min=100.0, price_band_max=100.0, lot_size=1000, min_investment=200000.0,
               issue_open_date=d, issue_close_date=d + timedelta(days=2)))
    await db.commit()

    async def finder(ipo):
        if ipo.slug != "dsc2-ipo-details":
            return None
        return "https://nsearchives.nseindia.com/emerge/corporates/content/Registration_DRHPDSC2.pdf"

    async def fetcher(url):
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0}

    await run_nightly(db, extractor=extractor, fetcher=fetcher, link_finder=finder, max_chunks=5)
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "DSC2"))).scalar_one()
    assert ipo.drhp_url and "DRHPDSC2" in ipo.drhp_url and not ipo.rhp_url


def test_ipowatch_slug_candidates_come_from_the_stored_slug_and_the_company_name():
    from app.jobs.nightly import _ipowatch_slugs
    from types import SimpleNamespace as NS
    stored = _ipowatch_slugs(NS(slug="watrana-rentals-ipo-details", name="Watrana Rentals Limited"))
    assert stored[0] == "watrana-rentals-ipo-details" and len(stored) == len(set(stored))   # stored slug first, no duplicates
    got = _ipowatch_slugs(NS(slug="watrana-rentals", name="Watrana Rentals Limited"))
    assert got[0] == "watrana-rentals-ipo-details"
    assert "watrana-rentals-limited-ipo-details" in got
    assert _ipowatch_slugs(NS(slug="x", name="")) == []


def test_ipowatch_links_embedded_in_page_scripts_are_found_too():
    html = ('<script>window.__DATA__ = {"drhp":"https:\/\/nsearchives.nseindia.com\/emerge\/corporates\/content\/Registration_DRHPWRL.pdf",'
            '"other":"https:\/\/evil.example.com\/x.pdf"}</script>')
    assert parse_ipowatch_detail(html) == "https://nsearchives.nseindia.com/emerge/corporates/content/Registration_DRHPWRL.pdf"
