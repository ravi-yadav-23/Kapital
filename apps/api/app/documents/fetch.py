"""Fetch an offer document (DRHP/RHP) safely: https only, official hosts only, bounded size, bounded redirects."""
import ipaddress
from typing import Optional
from urllib.parse import urljoin, urlparse, parse_qs

import httpx
from bs4 import BeautifulSoup

from app.documents.errors import DocumentError  # noqa: F401  (re-exported)

# Regulator and exchange hosts. Anything else is refused (no SSRF through scraped links).
ALLOWED_HOST_SUFFIXES = ("sebi.gov.in", "nseindia.com", "bseindia.com")
MAX_BYTES = 60 * 1024 * 1024
MAX_REDIRECTS = 3
USER_AGENT = "Mozilla/5.0 (compatible; KapitlDocumentFetcher/1.0)"


def is_allowed_url(url: str) -> bool:
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
    except ValueError:
        return False
    if p.scheme != "https" or not host:
        return False
    try:
        ipaddress.ip_address(host)
        return False  # IP literals are never allowed
    except ValueError:
        pass
    return any(host == s or host.endswith("." + s) for s in ALLOWED_HOST_SUFFIXES)


def _pdf_link(html: str, base: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    candidates = [a.get("href") for a in soup.find_all("a") if a.get("href")]
    candidates += [f.get("src") for f in soup.find_all(["iframe", "embed"]) if f.get("src")]
    for raw in candidates:
        file_param = parse_qs(urlparse(raw).query).get("file")  # SEBI viewer: ...?file=<pdf url>
        target = file_param[0] if file_param else raw
        if ".pdf" in target.lower():
            return urljoin(base, target)
    return None


async def _get(client: httpx.AsyncClient, url: str, max_bytes: int):
    for _ in range(MAX_REDIRECTS + 1):
        if not is_allowed_url(url):
            raise DocumentError("document host is not on the allow-list (or not https)")
        async with client.stream("GET", url, headers={"User-Agent": USER_AGENT}) as resp:
            if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
                url = urljoin(url, resp.headers["location"])
                continue
            if resp.status_code != 200:
                raise DocumentError(f"HTTP {resp.status_code} while fetching the document")
            declared = resp.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise DocumentError("document is larger than the size limit")
            body = bytearray()
            async for part in resp.aiter_bytes():
                body.extend(part)
                if len(body) > max_bytes:
                    raise DocumentError("document is larger than the size limit")
            return url, bytes(body), resp.headers.get("content-type", "")
    raise DocumentError("too many redirects")


async def fetch_document(url: str, *, client: Optional[httpx.AsyncClient] = None, max_bytes: int = MAX_BYTES,
                         _depth: int = 0) -> bytes:
    """Return the PDF bytes behind `url` (a PDF, or a filing page that links to one)."""
    own = client is None
    client = client or httpx.AsyncClient(timeout=60.0, follow_redirects=False)
    try:
        final_url, body, ctype = await _get(client, url, max_bytes)
        if body[:4] == b"%PDF":
            return body
        if "html" in ctype.lower() and _depth == 0:
            link = _pdf_link(body.decode("utf-8", errors="ignore"), final_url)
            if link:
                return await fetch_document(link, client=client, max_bytes=max_bytes, _depth=1)
        raise DocumentError("no PDF found at this address")
    except httpx.HTTPError as exc:
        raise DocumentError(f"network error: {type(exc).__name__}") from exc
    finally:
        if own:
            await client.aclose()
