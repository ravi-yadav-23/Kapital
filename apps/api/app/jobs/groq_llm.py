"""Groq fact extractor for the nightly job (free tier). Never called by web requests."""
import json
from typing import Any, Awaitable, Callable, Dict

from app.documents.facts import EXTRACTION_SYSTEM_PROMPT, clean_facts, verify_evidence
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
                # gpt-oss models "think" before answering and the thinking counts against the limit: a small
                # limit cut the JSON off mid-way (seen live as json_validate_failed).
                max_completion_tokens=3000,
                reasoning_effort="low",
            )
        except RateLimitError as exc:
            raise RateLimited(str(exc)) from exc
        extract.tokens_used += int(getattr(getattr(resp, "usage", None), "total_tokens", 0) or 0)
        return verify_evidence(clean_facts(json.loads(resp.choices[0].message.content or "{}")), text)

    extract.tokens_used = 0  # read by the nightly job to stay inside the daily token budget
    return extract
