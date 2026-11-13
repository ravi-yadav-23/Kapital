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


def test_a_flag_is_kept_only_if_its_quote_really_appears_in_the_excerpt():
    from app.documents.facts import verify_evidence
    text = "In March 2024, SEBI passed an order   against our\nPromoter imposing a penalty of Rs 5 lakh."
    good = {"regulatory_action_against_promoter": True,
            "regulatory_action_evidence": "SEBI passed an order against our Promoter imposing a penalty"}
    assert verify_evidence(dict(good), text) == good                       # whitespace differences are ignored
    invented = {"regulatory_action_against_promoter": True, "regulatory_action_evidence": "The promoter was jailed for fraud."}
    assert verify_evidence(dict(invented), text) == {}                    # quote not in the excerpt: dropped
    assert verify_evidence({"regulatory_action_against_promoter": True}, text) == {}
    other = {"net_profit_cr": 5.0, "regulatory_action_against_promoter": False}
    assert verify_evidence(dict(other), text) == other                    # only claims of "true" need proof


def test_evidence_strings_are_accepted_only_for_known_keys_and_sane_length():
    from app.documents.facts import clean_facts
    out = clean_facts({"regulatory_action_evidence": "x" * 40, "auditor_qualification_evidence": "y" * 5000,
                       "random_note": "hello", "net_profit_cr": 1.0})
    assert out == {"regulatory_action_evidence": "x" * 40, "net_profit_cr": 1.0}


@pytest.mark.asyncio
async def test_token_use_is_counted_for_the_nightly_budget():
    reply = _reply('{"net_profit_cr": 1.0}')
    reply.usage = SimpleNamespace(total_tokens=1234)
    create = AsyncMock(return_value=reply)
    with patch("groq.AsyncGroq", return_value=_client(create)):
        ex = make_groq_extractor("k", "m")
        assert ex.tokens_used == 0
        await ex("a")
        await ex("b")
    assert ex.tokens_used == 2468
