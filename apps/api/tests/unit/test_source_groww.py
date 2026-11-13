"""M2b: Groww plug-in - pure parser tested against a saved page (real upcoming/closed items + one synthetic
open issue, because no IPO is open on the capture date)."""
import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.sources.groww import GrowwSource, parse_groww_page

FIXTURE = (Path(__file__).resolve().parents[1] / "fixtures" / "groww_ipo_page.html").read_text(encoding="utf-8")
IST = ZoneInfo("Asia/Kolkata")


def _by_symbol():
    records, errors = parse_groww_page(FIXTURE)
    assert errors == []
    return {r["symbol"]: r for r in records}


def _ist_date(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, tz=IST).strftime("%Y-%m-%d")


def test_open_issue_has_real_terms_and_dates():
    r = _by_symbol()["SYNOPEN"]
    assert (r["price_band_min"], r["price_band_max"], r["lot_size"]) == (210.0, 221.0, 67)
    assert r["min_investment"] == 14807.0
    assert r["subscription_total"] == 2.8
    assert r["issue_open_date"] == _ist_date(1794508200000)
    assert r["issue_close_date"] == _ist_date(1794767400000)
    assert r["type"] == "EQ" and r["isin"] == "INE000SYN001"


def test_upcoming_issue_does_not_invent_terms():
    r = _by_symbol()["ZEPTEMP"]
    assert r["status"] == "upcoming"
    # price band / lot size are not published yet: unknown is 0, never a made-up 100 / 15 / 15000
    assert (r["price_band_min"], r["price_band_max"], r["lot_size"], r["min_investment"]) == (0.0, 0.0, 0, 0.0)


def test_upcoming_issue_keeps_the_sebi_filing_link_for_the_document_pipeline():
    r = _by_symbol()["ZEPTEMP"]
    assert r["document_url"].startswith("https://www.sebi.gov.in/filings/public-issues/")


def test_no_fabricated_text_or_scores():
    for r in _by_symbol().values():
        assert not r.get("about")
        assert r.get("strengths") == [] and r.get("risks") == []
        assert "score" not in r and "recommendation" not in r


def test_closed_issue_carries_the_listing_outcome():
    r = _by_symbol()["ANTALA"]
    assert r["status"] == "closed" and r["type"] == "SME"
    assert r["price_band_min"] == r["price_band_max"] == 66.0
    assert r["listing_price"] == 52.8
    assert r["listing_gain_percent"] == -20.0
    assert r["subscription_total"] == 12.09
    assert (r["issue_open_date"], r["issue_close_date"]) == ("2026-10-29", "2026-11-05")
    assert r["lot_size"] == 0  # not in the feed: unknown, not guessed


def test_page_without_next_data_is_reported_as_a_layout_change():
    records, errors = parse_groww_page("<html><body>blocked</body></html>")
    assert records == [] and any("__NEXT_DATA__" in e for e in errors)


def test_a_broken_item_is_skipped_not_fatal():
    html = FIXTURE.replace('"companyName": "Zepto"', '"companyName": ""')
    records, errors = parse_groww_page(html)
    assert "ZEPTEMP" not in {r["symbol"] for r in records}
    assert {"SYNOPEN", "ANTALA"} <= {r["symbol"] for r in records}


@pytest.mark.asyncio
async def test_fetch_returns_records_or_a_clear_error():
    ok = httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, text=FIXTURE)))
    res = await GrowwSource(client=ok).fetch()
    assert res.error is None and len(res.records) >= 3 and res.requests_used == 1

    blocked = httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(403, text="denied")))
    res = await GrowwSource(client=blocked).fetch()
    assert "403" in res.error and res.records == []

    changed = httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, text="<html></html>")))
    res = await GrowwSource(client=changed).fetch()
    assert "layout" in res.error.lower()
