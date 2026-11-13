"""M2b: IPO Watch plug-in. The site no longer renders an HTML table (it loads its list from a JSON endpoint),
so the old table scraper returned nothing. Tested against a real captured payload and a synthetic open issue."""
import json
from pathlib import Path

import httpx
import pytest

from app.sources.ipowatch import IpoWatchSource, parse_ipowatch_listing

FX = Path(__file__).resolve().parents[1] / "fixtures"
REAL = json.loads((FX / "ipowatch_listing_real.json").read_text(encoding="utf-8"))
SYNTH = json.loads((FX / "ipowatch_listing_synthetic_open.json").read_text(encoding="utf-8"))


def test_real_payload_parses_and_does_not_invent_anything():
    records, errors = parse_ipowatch_listing(REAL)
    assert errors == [] and [r["name"] for r in records] == [
        "Mahanadi Coalfields", "Hindustan Coca Cola", "Crystal Crop Protection"]
    for r in records:
        assert r["status"] == "upcoming" and r["type"] == "EQ"
        assert (r["price_band_min"], r["price_band_max"], r["lot_size"], r["min_investment"]) == (0.0, 0.0, 0, 0.0)
        assert not r.get("about") and r.get("strengths") == [] and r.get("risks") == []
        assert "score" not in r and "gmp_percent" not in r  # GMP 0 / not published is "no quote", not 0%


def test_dates_are_parsed_when_present():
    crystal = parse_ipowatch_listing(REAL)[0][2]
    assert (crystal["issue_open_date"], crystal["issue_close_date"]) == ("2026-11-18", "2026-11-20")
    undated = parse_ipowatch_listing(REAL)[0][0]
    assert undated["issue_open_date"] is None and undated["issue_close_date"] is None


def test_symbol_is_marked_as_derived_when_the_site_gives_none():
    records = parse_ipowatch_listing(REAL)[0]
    assert all(r["symbol"] and r["symbol_is_derived"] is True for r in records)
    synth = parse_ipowatch_listing(SYNTH)[0][0]
    assert synth["symbol"] == "SYNOPEN" and synth["symbol_is_derived"] is False


def test_open_mainboard_issue_has_real_terms_gmp_and_subscription():
    r = parse_ipowatch_listing(SYNTH)[0][0]
    assert r["status"] == "open" and r["type"] == "EQ"
    assert (r["price_band_min"], r["price_band_max"], r["lot_size"]) == (210.0, 221.0, 67)
    assert r["min_investment"] == 67 * 221 == 14807
    assert r["gmp_rupees"] == 66.3 and r["gmp_percent"] == pytest.approx(66.3 / 221 * 100, rel=1e-3)
    assert r["subscription_total"] == 3.4 and r["issue_size_cr"] == 450.0
    assert (r["issue_open_date"], r["issue_close_date"]) == ("2026-11-13", "2026-11-17")
    assert (r["allotment_date"], r["listing_date"]) == ("2026-11-18", "2026-11-20")


def test_sme_issue_uses_its_minimum_lots_and_a_negative_gmp_is_kept():
    r = parse_ipowatch_listing(SYNTH)[0][1]
    assert r["type"] == "SME" and (r["price_band_min"], r["price_band_max"], r["lot_size"]) == (94.0, 94.0, 1200)
    assert r["min_investment"] == 2 * 1200 * 94
    assert r["gmp_rupees"] == -4 and r["gmp_percent"] == pytest.approx(-4 / 94 * 100, rel=1e-3)


def test_bad_status_or_shape_is_an_error_not_an_empty_success():
    records, errors = parse_ipowatch_listing({"status": 0, "data": []})
    assert records == [] and errors
    records, errors = parse_ipowatch_listing({"unexpected": True})
    assert records == [] and errors


def test_an_entry_without_a_name_is_skipped():
    payload = {"status": 1, "data": [{"id": 1, "slug": "x"}, SYNTH["data"][0]]}
    records, errors = parse_ipowatch_listing(payload)
    assert [r["name"] for r in records] == ["Synthetic Open Industries"] and len(errors) == 1


@pytest.mark.asyncio
async def test_fetch_uses_the_json_endpoint_and_reports_problems():
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(str(req.url))
        return httpx.Response(200, json=SYNTH)

    res = await IpoWatchSource(client=httpx.AsyncClient(transport=httpx.MockTransport(handler))).fetch()
    assert calls == ["https://ipowatch.in/server/api/ipo/GetIpoListingByStatus"]
    assert res.error is None and len(res.records) == 2 and res.requests_used == 1

    blocked = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(403)))
    assert "403" in (await IpoWatchSource(client=blocked).fetch()).error

    html = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, text="<html>captcha</html>")))
    assert "json" in (await IpoWatchSource(client=html).fetch()).error.lower()
