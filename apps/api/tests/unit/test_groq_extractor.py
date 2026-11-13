"""The Groq fact extractor: request shape (seen live: a small token limit truncated the JSON), cleaning, rate limits."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import groq
import httpx
import pytest

from app.documents.store import RateLimited
from app.jobs.groq_llm import make_groq_extractor


def _reply(text):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


def _client(create):
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


@pytest.mark.asyncio
async def test_request_leaves_room_for_reasoning_and_asks_for_json():
    create = AsyncMock(return_value=_reply('{"net_profit_cr": 12.5, "pe_ratio": "20", "evil": 1}'))
    with patch("groq.AsyncGroq", return_value=_client(create)):
        out = await make_groq_extractor("k", "openai/gpt-oss-120b")("some excerpt")
    kwargs = create.await_args.kwargs
    assert kwargs["max_completion_tokens"] >= 2000          # reasoning tokens count against the limit
    assert kwargs["reasoning_effort"] == "low" and kwargs["temperature"] == 0.0
    assert kwargs["response_format"] == {"type": "json_object"}
    assert "untrusted" in kwargs["messages"][1]["content"].lower()
    assert out == {"net_profit_cr": 12.5}                    # unknown key and string number are dropped


@pytest.mark.asyncio
async def test_rate_limit_becomes_rate_limited():
    resp = httpx.Response(429, request=httpx.Request("POST", "https://api.groq.com/x"))
    create = AsyncMock(side_effect=groq.RateLimitError("slow down", response=resp, body=None))
    with patch("groq.AsyncGroq", return_value=_client(create)):
        with pytest.raises(RateLimited):
            await make_groq_extractor("k", "m")("text")


@pytest.mark.asyncio
async def test_empty_reply_gives_no_facts():
    create = AsyncMock(return_value=_reply(""))
    with patch("groq.AsyncGroq", return_value=_client(create)):
        assert await make_groq_extractor("k", "m")("text") == {}
