"""Last-resort company facts from the web, using Gemini with Google Search grounding.

A language model that can search the web can still state a number that no page contains. So nothing it says is trusted:
a fact is accepted only if
  1. its key is a numeric fact we know (booleans such as "regulatory action" are never taken from the web),
  2. the cited site is one the search really returned (grounding metadata),
  3. WE download the cited page (https, public addresses only) and the model's quote appears in it,
  4. the number is in the quote (a reported loss needs the word "loss", a profit must not be described as one).
Only the company's name is sent. Facts that pass carry `facts_basis = web_search` and their sources.
"""
import json
import re
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from app.documents.errors import DocumentError
from app.documents.facts import EVIDENCE_MAX, EVIDENCE_MIN, NUMERIC_RANGES, _squash, clean_facts
from app.documents.gemini import generate, reply_text

# numeric facts that may come from the web (derived ones and booleans may not)
WEB_KEYS = tuple(k for k in NUMERIC_RANGES if k != "net_margin_pct")
MAX_FACTS, MAX_PAGES = 8, 4

PROMPT = (
    "Find facts that are publicly reported about the Indian IPO company \"{name}\": its offer document (DRHP/RHP), stock "
    "exchange filings, or reputable financial news. Answer with ONE JSON object and nothing else: "
    "{{\"facts\": [{{\"key\": <one of {keys}>, \"value\": <number>, \"quote\": <an exact sentence or phrase copied "
    "from the page, 20 to 300 characters, containing the number>, \"source_url\": <the page address>}}]}}. "
    "Use Rs crore for money and percent for percentages. Include a fact only if a page states it explicitly with that "
    "number: do not estimate, do not calculate, do not guess. Answer {{\"facts\": []}} if nothing is stated."
)

_NUMBER = re.compile(r"-?\d[\d,]*\.?\d*")


def _numbers(text: str) -> List[float]:
    out = []
    for m in _NUMBER.findall(text):
        try:
            out.append(float(m.replace(",", "")))
        except ValueError:
            continue
    return out


def _number_in_quote(value: float, quote: str) -> bool:
    """The value (or its absolute value, for a loss) appears in the quote, within rounding."""
    tol = max(0.01 * abs(value), 0.06)
    if not any(abs(abs(n) - abs(value)) <= tol for n in _numbers(quote)):
        return False
    says_loss = re.search(r"\b(loss|negative|deficit)\b|\(\s*\d", quote, re.I) is not None
    return says_loss if value < 0 else not says_loss


def _host_in_results(url: str, titles: List[str]) -> bool:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    if not host:
        return False
    for t in titles:
        t = t.lower().strip().removeprefix("www.")
        if t and (host == t or host.endswith("." + t) or t.endswith(host)):
            return True
    return False


def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b <= a:
        return None
    try:
        data = json.loads(text[a:b + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


async def research_company_facts(
    name: str, *, api_key: str, model: str, client: Optional[httpx.AsyncClient] = None,
    page_fetcher: Optional[Callable[[str], Awaitable[str]]] = None,
) -> Optional[Dict[str, Any]]:
    """Verified facts for `name`, or None. Returns {"facts": {...}, "sources": [{key, url, quote}], "url": first url}."""
    if page_fetcher is None:
        from app.documents.fetch import fetch_text

        async def page_fetcher(url: str) -> str:  # type: ignore[misc]
            return await fetch_text(url, public_ok=True)

    own = client is None
    http = client or httpx.AsyncClient(timeout=90.0)
    try:
        body = {
            "contents": [{"role": "user", "parts": [{"text": PROMPT.format(name=name.strip()[:120], keys=", ".join(WEB_KEYS))}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 2048},
        }
        data = await generate(http, api_key, model, body)
    finally:
        if own:
            await http.aclose()

    cand = (data.get("candidates") or [{}])[0]
    chunks = (cand.get("groundingMetadata") or {}).get("groundingChunks") or []
    titles = [str((c.get("web") or {}).get("title") or "") for c in chunks]
    if not any(titles):
        return None                                   # the model did not actually search: nothing can be trusted
    parsed = _parse_json(reply_text(data))
    claims = parsed.get("facts") if parsed else None
    if not isinstance(claims, list):
        return None

    pages: Dict[str, Optional[str]] = {}
    facts: Dict[str, Any] = {}
    sources: List[Dict[str, str]] = []
    for claim in claims[:MAX_FACTS]:
        if not isinstance(claim, dict):
            continue
        key, value, quote, url = claim.get("key"), claim.get("value"), claim.get("quote"), claim.get("source_url")
        if key not in WEB_KEYS or key in facts:
            continue
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            continue
        if not (isinstance(quote, str) and EVIDENCE_MIN <= len(quote.strip()) <= EVIDENCE_MAX and isinstance(url, str)):
            continue
        if clean_facts({key: float(value)}).get(key) is None:          # out of the plausible range
            continue
        if not url.startswith("https://") or not _host_in_results(url, titles):
            continue
        if not _number_in_quote(float(value), quote):
            continue
        if url not in pages:
            if len(pages) >= MAX_PAGES:
                continue
            try:
                pages[url] = _squash(await page_fetcher(url))
            except DocumentError:
                pages[url] = None
        page = pages[url]
        if not page or _squash(quote) not in page:
            continue
        facts[key] = float(value)
        sources.append({"key": key, "url": url, "quote": quote.strip()})
    if not facts:
        return None
    return {"facts": facts, "sources": sources, "url": sources[0]["url"]}
