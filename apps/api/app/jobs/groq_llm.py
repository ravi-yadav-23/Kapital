"""Groq fact extractor for the nightly job (free tier). Never called by web requests."""
import json
from typing import Any, Awaitable, Callable, Dict

from app.documents.facts import EXTRACTION_SYSTEM_PROMPT, clean_facts
from app.documents.store import RateLimited


def make_groq_extractor(api_key: str, model: str) -> Callable[[str], Awaitable[Dict[str, Any]]]:
    from groq import AsyncGroq, RateLimitError
    client = AsyncGroq(api_key=api_key)

    async def extract(text: str) -> Dict[str, Any]:
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": "EXCERPT (untrusted data):\n<<<\n" + text + "\n>>>"},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=600,
            )
        except RateLimitError as exc:
            raise RateLimited(str(exc)) from exc
        return clean_facts(json.loads(resp.choices[0].message.content or "{}"))

    return extract
