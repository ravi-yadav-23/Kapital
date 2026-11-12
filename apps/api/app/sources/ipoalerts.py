"""ipoalerts.in plug-in (official JSON API; see https://ipoalerts.in/docs).

Free plan: open issues only, 1 IPO per request, 6 requests/minute, 25/day, no GMP.
Pro plan: all statuses, optional GMP add-on (includeGmp=true).
The API key is sent in the `x-api-key` header.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.sources.base import Source, SourceResult

logger = logging.getLogger("source.ipoalerts")

BASE_URL = "https://api.ipoalerts.in/ipos"


def _price_range(text: Any) -> Tuple[float, float]:
    raw = str(text or "").replace("₹", "").strip()
    if "-" in raw:
        a, b = raw.split("-", 1)
        return float(a), float(b)
    value = float(raw)
    return value, value


def _issue_size_cr(text: Any) -> float:
    try:
        return float(str(text or "0").lower().replace("cr", "").replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def _parse_one(raw: Dict[str, Any]) -> Dict[str, Any]:
    from app.utils.date_utils import compute_ipo_status
    from app.utils.text_utils import clean_text, clean_text_list

    symbol = (raw.get("symbol") or "").strip()
    name = (raw.get("name") or "").strip()
    if not symbol or not name:
        raise ValueError("entry without symbol/name")
    pmin, pmax = _price_range(raw.get("priceRange"))
    lot = int(raw.get("minQty") or 1)
    rec: Dict[str, Any] = {
        "symbol": clean_text(symbol),
        "name": clean_text(name),
        "slug": raw.get("slug") or symbol.lower(),
        "type": raw.get("type") or "EQ",
        "status": compute_ipo_status(raw.get("startDate"), raw.get("endDate")),
        "logo_url": raw.get("logo"),
        "price_band_min": pmin,
        "price_band_max": pmax,
        "lot_size": lot,
        "min_investment": float(raw.get("minAmount") or (pmax * lot)),
        "issue_size": clean_text(raw.get("issueSize")),
        "issue_size_cr": _issue_size_cr(raw.get("issueSize")),
        "issue_open_date": raw.get("startDate"),
        "issue_close_date": raw.get("endDate"),
        "listing_date": raw.get("listingDate"),
        "about": clean_text(raw.get("about")),
        "strengths": clean_text_list(raw.get("strengths") or []),
        "risks": clean_text_list(raw.get("risks") or []),
        "schedule": [{"event": s.get("event"), "date": s.get("date")} for s in (raw.get("schedule") or [])],
        "source": "ipoalerts",
    }
    if raw.get("prospectusUrl"):
        rec["prospectus_url"] = raw["prospectusUrl"]
    if raw.get("listingGain") not in (None, ""):
        try:
            rec["listing_gain_percent"] = float(str(raw["listingGain"]).replace("%", ""))
        except ValueError:
            pass
    sub = raw.get("subscription") or {}
    if sub.get("timesSubscribed") not in (None, ""):
        # NSE's overall multiple only: the API has no category split, so categories are NOT filled in.
        rec["subscription_total"] = float(sub["timesSubscribed"])
    gmp = (raw.get("gmp") or {}).get("aggregations") or {}
    median = gmp.get("median")
    if median is not None and pmax > 0:
        rec["gmp_rupees"] = float(median)
        rec["gmp_percent"] = float(median) / pmax * 100.0
    return rec


def parse_ipoalerts(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Normalise an API response. Returns (records, per-entry errors); a bad entry never aborts the rest."""
    records: List[Dict[str, Any]] = []
    errors: List[str] = []
    for raw in (payload or {}).get("ipos") or []:
        try:
            records.append(_parse_one(raw))
        except Exception as exc:
            errors.append(f"{raw.get('symbol') or raw.get('name') or raw.get('id')}: {exc}")
    return records, errors


class IpoAlertsSource(Source):
    name = "ipoalerts"
    empty_is_normal = True

    def __init__(self, api_key: Optional[str] = None, plan: Optional[str] = None,
                 page_delay: Optional[float] = None, client: Optional[httpx.AsyncClient] = None):
        self.api_key = settings.ipoalerts_api_key if api_key is None else api_key
        self.plan = (plan or settings.ipoalerts_plan or "free").lower()
        # free plan allows 6 requests/minute -> one every ~10 s
        self.page_delay = (10.5 if self.plan == "free" else 1.0) if page_delay is None else page_delay
        self._client = client
        self.daily_request_budget = settings.ipoalerts_daily_budget if self.plan == "free" else None

    def enabled(self) -> bool:
        return bool(settings.source_ipoalerts_enabled)

    @property
    def statuses(self) -> List[str]:
        return ["open"] if self.plan == "free" else ["open", "upcoming", "closed"]

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        if not self.api_key:
            return SourceResult(error="no ipoalerts API key configured (IPOALERTS_API_KEY)")
        client = self._client or httpx.AsyncClient(timeout=20.0)
        own_client = self._client is None
        headers = {"x-api-key": self.api_key, "Accept": "application/json"}
        result = SourceResult()
        try:
            for status in self.statuses:
                page = 1
                seen = set()
                while True:
                    if requests_allowed is not None and result.requests_used >= requests_allowed:
                        result.warnings.append("stopped: daily request budget reached")
                        return result
                    params: Dict[str, Any] = {"status": status, "page": page}
                    if self.plan != "free":
                        params["includeGmp"] = "true"
                    resp = await client.get(BASE_URL, params=params, headers=headers)
                    result.requests_used += 1
                    if resp.status_code != 200:
                        hint = " (invalid API key?)" if resp.status_code in (401, 403) else (
                            " (rate limited)" if resp.status_code == 429 else "")
                        result.error = f"HTTP {resp.status_code}{hint} for status={status}"
                        return result
                    payload = resp.json()
                    records, errors = parse_ipoalerts(payload)
                    result.warnings.extend(errors)
                    new = [r for r in records if r["symbol"] not in seen]
                    seen.update(r["symbol"] for r in new)
                    result.records.extend(new)
                    meta = payload.get("meta") or {}
                    total_pages = int(meta.get("totalPages") or 0)
                    if not new or page >= total_pages:
                        break
                    if resp.headers.get("x-ratelimit-remaining") == "0":
                        result.warnings.append("stopped: per-minute rate limit reached")
                        break
                    page += 1
                    if self.page_delay:
                        await asyncio.sleep(self.page_delay)
            return result
        except httpx.HTTPError as exc:
            result.error = f"{type(exc).__name__}: {exc}"
            return result
        finally:
            if own_client:
                await client.aclose()
