"""M2: ipoalerts.in plug-in - parsing against the documented payload shape, plus fetch behaviour."""
import json
from unittest.mock import patch

import httpx
import pytest

from app.sources.ipoalerts import IpoAlertsSource, parse_ipoalerts

# Shape taken from the ipoalerts "IPO object" reference (illustrative values).
OPEN_IPO = {
    "id": "ipo-456", "name": "Example Foods Limited", "symbol": "EXFOODS", "slug": "example-foods", "type": "EQ",
    "startDate": "2026-11-10", "endDate": "2026-11-12", "listingDate": "2026-11-17", "priceRange": "210-221",
    "listingGain": None, "minQty": 67, "minAmount": 14807, "issueSize": "450cr", "status": "open",
    "logo": "https://example.com/logo.png", "prospectusUrl": "https://example.com/exfoods-prospectus.pdf",
    "schedule": [{"date": "2026-11-10", "event": "Issue open date"}, {"date": "2026-11-17", "event": "Listing date"}],
    "about": "Example Foods makes packaged food.", "strengths": ["Wide distribution"], "risks": ["Commodity prices"],
    "gmp": {"lastUpdatedAt": "2026-11-11T10:30:00.000+00:00",
            "aggregations": {"min": 25, "max": 35, "mean": 30, "median": 30, "mode": 25},
            "sources": [{"name": "A", "gmpPrice": 35}, {"name": "B", "gmpPrice": 25}]},
    "subscription": {"noOfSharesOffered": 2038000, "noOfsharesBid": 5714000, "timesSubscribed": 2.8,
                     "updatedAt": "2026-11-12T08:00:00.000Z"},
}


def _payload(*ipos, total_pages=1, page=1):
    return {"meta": {"count": len(ipos), "countOnPage": len(ipos), "totalPages": total_pages, "page": page, "limit": 1},
            "ipos": list(ipos)}


def test_parses_core_fields():
    rec, errors = parse_ipoalerts(_payload(OPEN_IPO))
    assert errors == [] and len(rec) == 1
    r = rec[0]
    assert (r["symbol"], r["name"], r["type"]) == ("EXFOODS", "Example Foods Limited", "EQ")
    assert (r["price_band_min"], r["price_band_max"]) == (210.0, 221.0)
    assert (r["lot_size"], r["min_investment"], r["issue_size_cr"]) == (67, 14807.0, 450.0)
    assert (r["issue_open_date"], r["issue_close_date"], r["listing_date"]) == ("2026-11-10", "2026-11-12", "2026-11-17")
    assert r["schedule"][0] == {"event": "Issue open date", "date": "2026-11-10"}


def test_subscription_uses_times_subscribed_not_invented_categories():
    r = parse_ipoalerts(_payload(OPEN_IPO))[0][0]
    assert r["subscription_total"] == 2.8
    # the free API only reports the overall NSE multiple; categories must not be made up
    assert "subscription_qib" not in r or r["subscription_qib"] in (None, 0.0)


def test_gmp_percent_is_derived_from_the_median_and_the_upper_band():
    r = parse_ipoalerts(_payload(OPEN_IPO))[0][0]
    assert r["gmp_percent"] == pytest.approx(30 / 221 * 100, rel=1e-3)
    assert r["gmp_rupees"] == 30


def test_missing_gmp_and_subscription_are_simply_absent():
    bare = {k: v for k, v in OPEN_IPO.items() if k not in ("gmp", "subscription")}
    r = parse_ipoalerts(_payload(bare))[0][0]
    assert "gmp_percent" not in r and "subscription_total" not in r


def test_prospectus_url_is_kept_for_the_document_pipeline():
    r = parse_ipoalerts(_payload(OPEN_IPO))[0][0]
    assert r["prospectus_url"].endswith("exfoods-prospectus.pdf")


def test_a_broken_entry_is_reported_and_skipped_not_fatal():
    broken = {"id": "x", "name": "No Symbol Ltd"}
    records, errors = parse_ipoalerts(_payload(broken, OPEN_IPO))
    assert [r["symbol"] for r in records] == ["EXFOODS"]
    assert len(errors) == 1


def test_empty_payload_is_a_valid_empty_result():
    assert parse_ipoalerts(_payload()) == ([], [])


def _client_for(responses):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return responses.pop(0)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), calls


@pytest.mark.asyncio
async def test_fetch_sends_the_api_key_header_and_asks_only_for_open_issues(monkeypatch):
    client, calls = _client_for([httpx.Response(200, json=_payload(OPEN_IPO))])
    src = IpoAlertsSource(api_key="k123", plan="free", page_delay=0, client=client)
    res = await src.fetch(requests_allowed=10)
    assert res.error is None and len(res.records) == 1 and res.requests_used == 1
    assert calls[0].headers["x-api-key"] == "k123"
    assert calls[0].url.params["status"] == "open"
    assert "includeGmp" not in calls[0].url.params  # GMP is a paid add-on


@pytest.mark.asyncio
async def test_fetch_pages_through_results_within_the_request_budget():
    client, calls = _client_for([
        httpx.Response(200, json=_payload(OPEN_IPO, total_pages=3, page=1)),
        httpx.Response(200, json=_payload({**OPEN_IPO, "symbol": "TWO", "id": "2"}, total_pages=3, page=2)),
    ])
    src = IpoAlertsSource(api_key="k", plan="free", page_delay=0, client=client)
    res = await src.fetch(requests_allowed=2)
    assert [r["symbol"] for r in res.records] == ["EXFOODS", "TWO"]
    assert res.requests_used == 2
    assert any("budget" in w.lower() for w in res.warnings)  # stopped before page 3


@pytest.mark.asyncio
async def test_fetch_reports_rate_limit_and_bad_key_as_errors_without_raising():
    client, _ = _client_for([httpx.Response(429, json={"error": "slow down"})])
    res = await IpoAlertsSource(api_key="k", plan="free", page_delay=0, client=client).fetch(requests_allowed=5)
    assert res.records == [] and "429" in res.error

    client, _ = _client_for([httpx.Response(401, json={"error": "ERR:INVLDKEY"})])
    res = await IpoAlertsSource(api_key="bad", plan="free", page_delay=0, client=client).fetch(requests_allowed=5)
    assert "401" in res.error


@pytest.mark.asyncio
async def test_fetch_without_an_api_key_is_a_clear_error_and_makes_no_request():
    client, calls = _client_for([])
    res = await IpoAlertsSource(api_key="", plan="free", page_delay=0, client=client).fetch(requests_allowed=5)
    assert "api key" in res.error.lower() and calls == []


@pytest.mark.asyncio
async def test_pro_plan_asks_for_all_statuses_and_gmp():
    client, calls = _client_for([httpx.Response(200, json=_payload()) for _ in range(3)])
    await IpoAlertsSource(api_key="k", plan="pro", page_delay=0, client=client).fetch(requests_allowed=10)
    assert sorted(c.url.params["status"] for c in calls) == ["closed", "open", "upcoming"]
    assert all(c.url.params["includeGmp"] == "true" for c in calls)
