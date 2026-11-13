"""Groww plug-in: reads the server-rendered Next.js payload (`__NEXT_DATA__`) of https://groww.in/ipo.

The parser is a pure function so it can be tested against a saved page. Unknown values are reported as
0 / empty - never filled with made-up numbers or generic marketing text.
"""
import datetime
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.sources.base import Source, SourceResult
from app.utils.date_utils import compute_ipo_status
from app.utils.text_utils import clean_text

logger = logging.getLogger("source.groww")

URL = "https://groww.in/ipo"
IST = ZoneInfo("Asia/Kolkata")
SME_MIN_APPLICATION = 200000.0  # SEBI: minimum SME application value
MAX_CLOSED = 30  # keep the latest closed issues so history/outcomes are preserved


def _ist_date(ms: Any) -> Optional[str]:
    if not ms:
        return None
    return datetime.datetime.fromtimestamp(float(ms) / 1000, tz=IST).strftime("%Y-%m-%d")


def _slug(item: Dict[str, Any], name: str) -> str:
    return item.get("searchId") or re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()


def _base(item: Dict[str, Any]) -> Dict[str, Any]:
    name = clean_text(item.get("companyName", ""))
    if not name:
        raise ValueError("item without a company name")
    is_sme = bool(item.get("isSme", False))
    rec: Dict[str, Any] = {
        "symbol": clean_text(item.get("symbol", "")).upper(),
        "name": name,
        "slug": _slug(item, name),
        "type": "SME" if is_sme else "EQ",
        "logo_url": item.get("logoUrl"),
        "price_band_min": 0.0,
        "price_band_max": 0.0,
        "lot_size": 0,
        "min_investment": 0.0,
        "strengths": [],
        "risks": [],
        "source": "groww",
        "is_groww_feed": True,  # primary ground truth in the merge (names, dates, lot sizes)
    }
    if item.get("isin"):
        rec["isin"] = item["isin"]
    return rec


def _parse_open(item: Dict[str, Any]) -> Dict[str, Any]:
    rec = _base(item)
    cat = (item.get("categories") or [{}])[0]
    pmin = float(cat.get("minPrice") or 0.0)
    pmax = float(cat.get("maxPrice") or pmin or 0.0)
    lot = int(cat.get("lotSize") or 0)
    open_d, close_d = _ist_date(item.get("bidStartTimestamp")), _ist_date(item.get("bidEndTimestamp"))
    value = lot * pmax
    if rec["type"] == "SME" and 0 < value < SME_MIN_APPLICATION:
        lots = max(2, int(SME_MIN_APPLICATION / value) + (1 if SME_MIN_APPLICATION % value else 0))
        min_inv = round(lots * value, 2)
    else:
        min_inv = round(value, 2)
    rec.update(
        status=compute_ipo_status(open_d, close_d), price_band_min=pmin, price_band_max=pmax, lot_size=lot,
        min_investment=min_inv, issue_open_date=open_d, issue_close_date=close_d,
    )
    if item.get("overallSubscription"):
        rec["subscription_total"] = float(item["overallSubscription"])
    return rec


def _parse_upcoming(item: Dict[str, Any]) -> Dict[str, Any]:
    rec = _base(item)
    rec.update(
        status="upcoming",
        issue_open_date=_ist_date(item.get("bidStartTimestamp")),
        issue_close_date=_ist_date(item.get("bidEndTimestamp")),
    )
    if item.get("documentUrl"):
        rec["document_url"] = item["documentUrl"]  # link to the SEBI filing page (DRHP/UDRHP)
    return rec


def _parse_closed(item: Dict[str, Any]) -> Dict[str, Any]:
    rec = _base(item)
    issue_price = float(item.get("issuePrice") or 0.0)
    open_d, close_d, allot_d = item.get("openingDate"), item.get("closingDate"), item.get("allotmentDate")
    if allot_d and close_d and close_d > allot_d:  # Groww sometimes puts the listing date into closingDate
        close_d = allot_d
    rec.update(
        status="closed", price_band_min=issue_price, price_band_max=issue_price,
        issue_open_date=open_d, issue_close_date=close_d, allotment_date=allot_d,
        listing_date=_ist_date(item.get("listingTimestamp")),
    )
    if item.get("overallSubscription"):
        rec["subscription_total"] = float(item["overallSubscription"])
    if item.get("listingPrice") not in (None, ""):
        rec["listing_price"] = float(item["listingPrice"])
    if item.get("listingReturn") not in (None, ""):
        rec["listing_gain_percent"] = float(item["listingReturn"])
    return rec


def parse_groww_page(html: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Returns (records, problems). A missing payload is reported as a layout change."""
    tag = BeautifulSoup(html or "", "html.parser").find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        return [], ["no __NEXT_DATA__ payload found (layout change or blocked page)"]
    try:
        props = json.loads(tag.string).get("props", {}).get("pageProps", {})
    except (ValueError, AttributeError) as exc:
        return [], [f"__NEXT_DATA__ is not valid JSON: {exc}"]

    records: List[Dict[str, Any]] = []
    problems: List[str] = []
    plan = (
        ("openDataList", _parse_open, None),
        ("upcomingDataList", _parse_upcoming, None),
        ("closedDataList", _parse_closed, MAX_CLOSED),
    )
    for key, parser, limit in plan:
        items = props.get(key) or []
        for item in items[:limit] if limit else items:
            try:
                records.append(parser(item))
            except Exception as exc:
                problems.append(f"{key}: {item.get('symbol') or item.get('companyName')}: {exc}")
    return records, problems


class GrowwSource(Source):
    name = "groww"

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    def enabled(self) -> bool:
        return bool(settings.source_groww_enabled)

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        client = self._client or httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20.0)
        try:
            resp = await client.get(URL)
        except httpx.HTTPError as exc:
            return SourceResult(error=f"{type(exc).__name__}: {exc}", requests_used=1)
        finally:
            if self._client is None:
                await client.aclose()
        if resp.status_code != 200:
            return SourceResult(error=f"HTTP {resp.status_code} from groww.in", requests_used=1)
        records, problems = parse_groww_page(resp.text)
        if not records and problems and "layout" in problems[0]:
            return SourceResult(error="layout change: " + problems[0], requests_used=1)
        return SourceResult(records=records, requests_used=1, warnings=problems)
