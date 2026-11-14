"""IPO Watch plug-in: reads the JSON the site's own page loads (`/server/api/ipo/GetIpoListingByStatus`).

The old scraper parsed HTML tables; the site now renders its list with JavaScript, so that scraper silently
returned nothing. The endpoint is undocumented and can change: the parser is a pure function tested against a
captured payload, and layout problems surface as errors / health warnings.
Unknown values are 0 / absent, never invented.
"""
import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.sources.base import Source, SourceResult
from app.utils.date_utils import compute_ipo_status
from app.utils.text_utils import clean_text

logger = logging.getLogger("source.ipowatch")

URL = "https://ipowatch.in/server/api/ipo/GetIpoListingByStatus"


def _date(text: Any) -> Optional[str]:
    """'13 Nov 2026' -> '2026-11-13'; anything else (None, 'TBA') -> None."""
    if not text or not isinstance(text, str):
        return None
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _numbers(text: Any) -> List[float]:
    cleaned = str(text or "").replace(",", "")
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", cleaned)]


def _derived_symbol(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", name).upper()[:10] or "UNKNOWN"


def _parse_one(raw: Dict[str, Any]) -> Dict[str, Any]:
    name = clean_text(raw.get("name") or "")
    if not name:
        raise ValueError("entry without a name")
    ipo_type = "SME" if "sme" in str(raw.get("type") or "").lower() else "EQ"
    nums = _numbers(raw.get("priceBand"))
    pmin = nums[0] if nums else 0.0
    pmax = nums[1] if len(nums) > 1 else pmin
    lot_nums = _numbers(raw.get("lotSize"))
    lot = int(lot_nums[0]) if lot_nums else 0
    min_lots = max(1, int(raw.get("minLots") or 1))
    open_d, close_d = _date(raw.get("openDate")), _date(raw.get("closeDate"))
    abbr = (raw.get("abbr") or "").strip()

    status = compute_ipo_status(open_d, close_d)
    site_status = str(raw.get("issueStatus") or "").lower()
    if site_status == "open" and status != "closed":
        status = "open"

    rec: Dict[str, Any] = {
        "symbol": abbr.upper() if abbr else _derived_symbol(name),
        "symbol_is_derived": not abbr,
        "name": name,
        "slug": raw.get("slug") or re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower(),
        "type": ipo_type,
        "status": status,
        "logo_url": raw.get("logo"),
        "price_band_min": pmin,
        "price_band_max": pmax,
        "lot_size": lot,
        "min_investment": round(min_lots * lot * pmax, 2) if lot and pmax else 0.0,
        "issue_size_cr": float(raw.get("issueSize") or 0.0),
        "issue_open_date": open_d,
        "issue_close_date": close_d,
        "strengths": [],
        "risks": [],
        "source": "ipowatch",
        "is_secondary_feed": True,
    }
    for key, field in (("allotmentDate", "allotment_date"), ("listingDate", "listing_date")):
        d = _date(raw.get(key))
        if d:
            rec[field] = d
    # GMP: 0 / null means "no quote published", not "0%"
    gmp = raw.get("gmp")
    if gmp not in (None, "", 0, 0.0) and pmax > 0:
        rec["gmp_rupees"] = float(gmp)
        rec["gmp_percent"] = round(float(gmp) / pmax * 100.0, 4)
    if raw.get("subscription"):
        rec["subscription_total"] = float(raw["subscription"])
    return rec


def parse_ipowatch_listing(payload: Any) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Returns (records, problems)."""
    if not isinstance(payload, dict) or payload.get("status") != 1 or not isinstance(payload.get("data"), list):
        return [], ["unexpected response shape from ipowatch (layout/API change?)"]
    records: List[Dict[str, Any]] = []
    problems: List[str] = []
    for raw in payload["data"]:
        try:
            records.append(_parse_one(raw))
        except Exception as exc:
            problems.append(f"{raw.get('name') or raw.get('id')}: {exc}")
    return records, problems


class IpoWatchSource(Source):
    name = "ipowatch"
    # an empty list is plausible in a quiet period; shape changes are reported as errors instead
    empty_is_normal = True

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    def enabled(self) -> bool:
        return bool(settings.source_ipowatch_enabled)

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
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
            return SourceResult(error=f"HTTP {resp.status_code} from ipowatch.in", requests_used=1)
        try:
            payload = resp.json()
        except ValueError:
            return SourceResult(error="response was not JSON (blocked or layout change?)", requests_used=1)
        records, problems = parse_ipowatch_listing(payload)
        if not records and problems and "unexpected response" in problems[0]:
            return SourceResult(error=problems[0], requests_used=1)
        return SourceResult(records=records, requests_used=1, warnings=problems)


def parse_ipowatch_detail(html: str) -> Optional[str]:
    """The offer-document PDF an IPO Watch IPO page links to, only on regulator/exchange hosts.
    The final RHP is preferred over the draft (DRHP) when both are linked."""
    from bs4 import BeautifulSoup
    from app.documents.fetch import is_allowed_url
    text = html or ""
    links = [a.get("href") for a in BeautifulSoup(text, "html.parser").find_all("a") if a.get("href")]
    # the page is script-rendered, so the link may only appear inside embedded JSON (with backslash-escaped slashes)
    unescaped = text.replace("\\/", "/")
    links += re.findall(r"https?://[^\s\"'<>\\]+?\.pdf", unescaped, flags=re.I)
    pdfs = list(dict.fromkeys(u for u in links if ".pdf" in u.lower() and is_allowed_url(u)))
    final = [u for u in pdfs if "rhp" in u.lower() and "drhp" not in u.lower()]
    return (final or pdfs or [None])[0]


async def fetch_document_link(slug: str, client: Optional[httpx.AsyncClient] = None) -> Optional[str]:
    """Look up an IPO's offer-document link on its IPO Watch page. Any problem means 'not found'."""
    if not re.fullmatch(r"[a-z0-9-]{3,120}", slug or ""):
        return None
    own = client is None
    client = client or httpx.AsyncClient(follow_redirects=True, timeout=20.0, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"})
    try:
        resp = await client.get(f"https://ipowatch.in/ipo/{slug}")
        return parse_ipowatch_detail(resp.text) if resp.status_code == 200 else None
    except httpx.HTTPError:
        return None
    finally:
        if own:
            await client.aclose()
