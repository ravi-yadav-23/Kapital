"""Fetch an offer document (DRHP/RHP) safely: https only, regulator hosts (or, with public_ok, public issuer hosts
that resolve to public addresses), bounded size, bounded redirects."""
import asyncio
import ipaddress
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse, parse_qs

import httpx
from bs4 import BeautifulSoup

from app.documents.errors import DocumentError  # noqa: F401  (re-exported)

# Regulator and exchange hosts, always allowed. Other hosts need public_ok and pass the public-address check.
ALLOWED_HOST_SUFFIXES = ("sebi.gov.in", "nseindia.com", "bseindia.com")
MAX_BYTES = 60 * 1024 * 1024
MAX_REDIRECTS = 3
USER_AGENT = "Mozilla/5.0 (compatible; KapitlDocumentFetcher/1.0)"


def _is_official(host: str) -> bool:
    return any(host == s or host.endswith("." + s) for s in ALLOWED_HOST_SUFFIXES)


def is_allowed_url(url: str, *, public_ok: bool = False) -> bool:
    """https only. Regulator/exchange hosts are always allowed. With `public_ok` any ordinary public host is
    allowed too (an issuer's own site); the host must then also resolve to public addresses (see _get)."""
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
        port = p.port
    except ValueError:
        return False
    if p.scheme != "https" or not host or p.username or p.password or port not in (None, 443):
        return False
    try:
        ipaddress.ip_address(host)
        return False  # IP literals are never allowed
    except ValueError:
        pass
    if _is_official(host):
        return True
    if not public_ok:
        return False
    return "." in host and not host.endswith((".local", ".localhost", ".internal", ".lan", ".home", ".corp"))


async def _resolves_public(host: str) -> bool:
    """True only if every address the host resolves to is a public one (blocks private/link-local targets)."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        return False
    return bool(infos) and all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


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


async def _get(client: httpx.AsyncClient, url: str, max_bytes: int, public_ok: bool = False):
    for _ in range(MAX_REDIRECTS + 1):
        if not is_allowed_url(url, public_ok=public_ok):
            raise DocumentError("document host is not allowed (not https, not a permitted host, or an unsafe address)")
        host = (urlparse(url).hostname or "").lower()
        if not _is_official(host) and not await _resolves_public(host):
            raise DocumentError("document host does not resolve to a public address")
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
                         public_ok: bool = False, _depth: int = 0) -> bytes:
    """Return the PDF bytes behind `url` (a PDF, or a filing page that links to one)."""
    own = client is None
    client = client or httpx.AsyncClient(timeout=60.0, follow_redirects=False)
    try:
        for attempt in (1, 2):  # one retry: SEBI/NSE/issuer servers drop connections or time out now and then
            try:
                final_url, body, ctype = await _get(client, url, max_bytes, public_ok)
                break
            except httpx.TransportError:
                if attempt == 2:
                    raise
        if body[:4] == b"%PDF":
            return body
        if "html" in ctype.lower() and _depth == 0:
            link = _pdf_link(body.decode("utf-8", errors="ignore"), final_url)
            if link:
                return await fetch_document(link, client=client, max_bytes=max_bytes, public_ok=public_ok, _depth=1)
        raise DocumentError("no PDF found at this address")
    except httpx.HTTPError as exc:
        raise DocumentError(f"network error: {type(exc).__name__}") from exc
    finally:
        if own:
            await client.aclose()
