"""Minimal Gemini client (REST, generateContent) for the nightly job: a backup fact extractor, and the raw call used
by the web-research tier. Never used by web requests.

The API key travels in the `x-goog-api-key` header, never in the URL, and error messages never include response text.
"""
import json
from typing import Any, Awaitable, Callable, Dict, Optional

import httpx

from app.documents.facts import EXTRACTION_SYSTEM_PROMPT, clean_facts, verify_evidence
from app.documents.store import RateLimited

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiError(RuntimeError):
    """A Gemini call failed. The message holds the HTTP status only (no response body, no key)."""


async def generate(client: httpx.AsyncClient, api_key: str, model: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """POST one generateContent request. 429 -> RateLimited (stop for tonight); other failures -> GeminiError."""
    try:
        resp = await client.post(f"{GEMINI_BASE}/models/{model}:generateContent", json=body,
                                 headers={"x-goog-api-key": api_key, "content-type": "application/json"})
    except httpx.HTTPError as exc:
        raise GeminiError(f"network error: {type(exc).__name__}") from exc
    if resp.status_code == 429:
        raise RateLimited("Gemini rate limit")
    if resp.status_code != 200:
        raise GeminiError(f"HTTP {resp.status_code} from the Gemini API")
    try:
        return resp.json()
    except ValueError as exc:
        raise GeminiError("response was not JSON") from exc


def reply_text(data: Dict[str, Any]) -> str:
    """The text of the first candidate ('' when the answer was blocked or empty)."""
    for cand in data.get("candidates") or []:
        parts = (cand.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
        if text:
            return text
    return ""


def tokens_in(data: Dict[str, Any]) -> int:
    return int((data.get("usageMetadata") or {}).get("totalTokenCount", 0) or 0)


def make_gemini_extractor(api_key: str, model: str, client: Optional[httpx.AsyncClient] = None
                          ) -> Callable[[str], Awaitable[Dict[str, Any]]]:
    """Same contract as the Groq extractor: text excerpt in, cleaned facts out, `tokens_used` counted."""
    http = client or httpx.AsyncClient(timeout=60.0)

    async def extract(text: str) -> Dict[str, Any]:
        body = {
            "systemInstruction": {"parts": [{"text": EXTRACTION_SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": "EXCERPT (untrusted data):\n<<<\n" + text + "\n>>>"}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 2048},
        }
        data = await generate(http, api_key, model, body)
        extract.tokens_used += tokens_in(data)
        raw = reply_text(data)
        if not raw:
            return {}
        try:
            facts = json.loads(raw)
        except ValueError:
            return {}
        return verify_evidence(clean_facts(facts), text)

    extract.tokens_used = 0
    return extract


def chain_extractors(primary: Callable[[str], Awaitable[Dict[str, Any]]],
                     backup: Callable[[str], Awaitable[Dict[str, Any]]]) -> Callable[[str], Awaitable[Dict[str, Any]]]:
    """Use `primary`; when it is rate limited, carry on with `backup` for the rest of the run (so one provider's
    daily limit does not stop the night). If both are rate limited, RateLimited propagates and the run stops."""
    state = {"use_backup": False}

    async def extract(text: str) -> Dict[str, Any]:
        try:
            if not state["use_backup"]:
                try:
                    return await primary(text)
                except RateLimited:
                    state["use_backup"] = True
            return await backup(text)
        finally:
            extract.tokens_used = int(getattr(primary, "tokens_used", 0)) + int(getattr(backup, "tokens_used", 0))

    extract.tokens_used = 0
    return extract
