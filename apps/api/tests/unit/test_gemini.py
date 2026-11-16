"""Gemini: backup extractor for the nightly job and a verified web-search tier (last resort for company facts).

Nothing here calls the real API: HTTP is mocked. The web tier's rule is that a fact is accepted only if
(1) it is a numeric fact we know, (2) the cited page really is among the sites the search returned,
(3) we download that page ourselves and the model's quote appears in it, and (4) the number is in the quote.
"""
import json
from datetime import date, timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.documents.errors import DocumentError
from app.documents.facts import company_score_from_facts
from app.documents.fetch import fetch_text
from app.documents.gemini import GeminiError, chain_extractors, make_gemini_extractor
from app.documents.store import RateLimited
from app.documents.webresearch import research_company_facts
from app.jobs.nightly import run_nightly
from app.models.analysis import AnalysisChunk, AnalysisResult, AnalysisVersion
from app.models.ipo import Ipo
from app.routers.analysis import _payload
from app.services.rating import rate
from tests.unit.test_documents_pipeline import make_pdf

KEY = "test-gemini-key-not-real"


def _reply(text, titles=(), tokens=321):
    body = {"candidates": [{"content": {"parts": [{"text": text}]}}], "usageMetadata": {"totalTokenCount": tokens}}
    if titles:
        body["candidates"][0]["groundingMetadata"] = {
            "webSearchQueries": ["q"],
            "groundingChunks": [{"web": {"uri": f"https://vertexaisearch.cloud.google.com/grounding-api-redirect/{i}", "title": t}}
                                for i, t in enumerate(titles)]}
    return body


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# ------------------------------------------------------------------ extractor ----------------------------------
@pytest.mark.asyncio
async def test_extractor_request_shape_cleaning_and_token_count():
    seen = {}

    def handler(req):
        seen["url"], seen["key"], seen["body"] = str(req.url), req.headers.get("x-goog-api-key"), json.loads(req.content)
        return httpx.Response(200, json=_reply('{"net_profit_cr": 12.5, "pe_ratio": "20", "junk": 1}'))

    async with _client(handler) as c:
        ex = make_gemini_extractor(KEY, "gemini-2.5-flash-lite", client=c)
        out = await ex("some excerpt")
        await ex("again")
    assert out == {"net_profit_cr": 12.5}                               # unknown key and string number dropped
    assert "gemini-2.5-flash-lite:generateContent" in seen["url"]
    assert seen["key"] == KEY and KEY not in seen["url"]                 # the key travels in a header, never in the URL
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert seen["body"]["generationConfig"]["temperature"] == 0
    assert "untrusted" in json.dumps(seen["body"]["contents"]).lower()
    assert ex.tokens_used == 642


@pytest.mark.asyncio
async def test_extractor_drops_unquoted_critical_claims():
    text = "In March 2024, SEBI passed an order against our Promoter imposing a penalty of Rs 5 lakh."
    reply = '{"regulatory_action_against_promoter": true, "regulatory_action_evidence": "The promoter was jailed for fraud."}'
    async with _client(lambda r: httpx.Response(200, json=_reply(reply))) as c:
        assert await make_gemini_extractor(KEY, "m", client=c)(text) == {}


@pytest.mark.asyncio
async def test_rate_limit_empty_reply_and_server_errors():
    async with _client(lambda r: httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}})) as c:
        with pytest.raises(RateLimited):
            await make_gemini_extractor(KEY, "m", client=c)("x")
    async with _client(lambda r: httpx.Response(200, json={"candidates": [], "promptFeedback": {"blockReason": "SAFETY"}})) as c:
        assert await make_gemini_extractor(KEY, "m", client=c)("x") == {}
    async with _client(lambda r: httpx.Response(500, text="boom " + KEY)) as c:
        with pytest.raises(GeminiError) as err:
            await make_gemini_extractor(KEY, "m", client=c)("x")
    assert KEY not in str(err.value)                                     # error text never echoes the key


@pytest.mark.asyncio
async def test_chain_switches_to_the_backup_when_the_first_is_rate_limited_and_stays_there():
    calls = []

    async def primary(text):
        calls.append("primary")
        primary.tokens_used += 10
        raise RateLimited("slow down")

    async def backup(text):
        calls.append("backup")
        backup.tokens_used += 5
        return {"net_profit_cr": 1.0}

    primary.tokens_used = backup.tokens_used = 0
    chained = chain_extractors(primary, backup)
    assert await chained("a") == {"net_profit_cr": 1.0}
    assert await chained("b") == {"net_profit_cr": 1.0}
    assert calls == ["primary", "backup", "backup"]                      # primary is not retried every chunk
    assert chained.tokens_used == 20

    async def also_limited(text):
        raise RateLimited("me too")

    also_limited.tokens_used = 0
    with pytest.raises(RateLimited):
        await chain_extractors(primary, also_limited)("c")


# ------------------------------------------------------------------ page text ----------------------------------
@pytest.mark.asyncio
async def test_fetch_text_reads_html_and_pdf_and_refuses_unsafe_hosts():
    html = "<html><script>var x=1</script><body><p>Net profit was Rs 84.2 crore.</p></body></html>"

    def handler(req):
        if req.url.path.endswith(".pdf"):
            return httpx.Response(200, content=make_pdf(["Promoter holding 71.5 percent"]), headers={"content-type": "application/pdf"})
        return httpx.Response(200, text=html, headers={"content-type": "text/html"})

    from unittest.mock import patch
    with patch("app.documents.fetch._resolves_public", return_value=True):
        async with _client(handler) as c:
            assert "Net profit was Rs 84.2 crore." in await fetch_text("https://example-news.com/a", client=c)
            assert "var x" not in await fetch_text("https://example-news.com/a", client=c)
            assert "Promoter holding 71.5" in await fetch_text("https://example-news.com/x.pdf", client=c)
            with pytest.raises(DocumentError):
                await fetch_text("http://example-news.com/a", client=c)          # not https
            with pytest.raises(DocumentError):
                await fetch_text("https://127.0.0.1/a", client=c)


# ------------------------------------------------------------------ web research -------------------------------
PAGE = "Hero Fincorp reported a profit after tax of Rs 637.05 crore in FY24 while promoter holding stands at 41.2 percent post issue."


def _facts(*items):
    return json.dumps({"facts": [dict(key=k, value=v, quote=q, source_url=u) for k, v, q, u in items]})


GOOD = ("net_profit_cr", 637.05, "reported a profit after tax of Rs 637.05 crore in FY24", "https://www.moneycontrol.com/hero-ipo")


async def _research(reply, titles=("moneycontrol.com",), page=PAGE, fetch_error=False, name="Hero Fincorp"):
    seen = {"bodies": []}

    def handler(req):
        seen["bodies"].append(json.loads(req.content))
        seen["key"] = req.headers.get("x-goog-api-key")
        return httpx.Response(200, json=_reply(reply, titles))

    async def page_fetcher(url):
        if fetch_error:
            raise DocumentError("HTTP 404")
        return page

    async with _client(handler) as c:
        out = await research_company_facts(name, api_key=KEY, model="gemini-2.5-flash", client=c, page_fetcher=page_fetcher)
    return out, seen


@pytest.mark.asyncio
async def test_a_verified_fact_is_accepted_with_its_source_and_only_the_name_is_sent():
    out, seen = await _research(_facts(GOOD))
    assert out["facts"] == {"net_profit_cr": 637.05}
    assert out["sources"] == [{"key": "net_profit_cr", "url": GOOD[3], "quote": GOOD[2]}]
    assert out["url"] == GOOD[3]
    body = seen["bodies"][0]
    assert body["tools"] == [{"google_search": {}}] and "responseMimeType" not in body.get("generationConfig", {})
    prompt = json.dumps(body["contents"])
    assert "Hero Fincorp" in prompt and "gmp" not in prompt.lower() and "score" not in prompt.lower()
    assert seen["key"] == KEY


@pytest.mark.asyncio
@pytest.mark.parametrize("label,reply,kwargs", [
    ("quote not on the page", _facts(("net_profit_cr", 637.05, "reported a profit of Rs 900 crore in FY24", GOOD[3])), {}),
    ("number not in the quote", _facts(("net_profit_cr", 999.0, GOOD[2], GOOD[3])), {}),
    ("site was not in the search results", _facts(GOOD), {"titles": ("economictimes.com",)}),
    ("no search results at all", _facts(GOOD), {"titles": ()}),
    ("page could not be downloaded", _facts(GOOD), {"fetch_error": True}),
    ("boolean claims are never taken from the web", _facts(("regulatory_action_against_promoter", True, GOOD[2], GOOD[3])), {}),
    ("unknown key", _facts(("favourite_colour", 5.0, GOOD[2], GOOD[3])), {}),
    ("not json", "I could not find anything", {}),
    ("sign flipped (a loss reported as profit)", _facts(("net_profit_cr", -637.05, GOOD[2], GOOD[3])), {}),
])
async def test_unverifiable_facts_are_discarded(label, reply, kwargs):
    out, _ = await _research(reply, **kwargs)
    assert out is None, label


@pytest.mark.asyncio
async def test_a_reported_loss_needs_the_word_loss_in_the_quote():
    page = "The company reported a net loss of Rs 191.9 crore in FY22."
    quote = "reported a net loss of Rs 191.9 crore in FY22"
    out, _ = await _research(_facts(("net_profit_cr", -191.9, quote, GOOD[3])), page=page)
    assert out["facts"] == {"net_profit_cr": -191.9}
    wrong, _ = await _research(_facts(("net_profit_cr", 191.9, quote, GOOD[3])), page=page)
    assert wrong is None


def test_web_facts_are_capped_lower_than_the_groww_summary():
    f = {"net_profit_cr": 300.0, "revenue_growth_pct": 40.0, "net_margin_pct": 25.0}
    assert company_score_from_facts(f, limited=True, cap=60) <= 60
    web = rate({"gmp_percent": 20.0, "subscription_total": 5.0, "name": "Plain Ltd"}, dict(f, facts_basis="web_search"))
    assert web["facts_basis"] == "web_search" and web["documents_analysed"] is False


# ------------------------------------------------------------------ nightly integration ------------------------
@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        for m in (AnalysisResult, AnalysisChunk, AnalysisVersion):
            await s.execute(delete(m))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("GEM%")))
        await s.commit()


def _ipo(symbol, **kw):
    d = date.today()
    base = dict(id=f"id-{symbol}", symbol=symbol, name=f"{symbol} Ltd", slug=f"{symbol.lower()}-ipo", type="EQ",
                status="open", price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=d, issue_close_date=d + timedelta(days=2), gmp_percent=20.0, subscription_total=5.0)
    base.update(kw)
    return Ipo(**base)


WEB = {"facts": {"net_profit_cr": 40.0, "revenue_growth_pct": 30.0, "net_margin_pct": 12.0},
       "sources": [{"key": "net_profit_cr", "url": "https://www.moneycontrol.com/x", "quote": "profit of Rs 40 crore for the year"}],
       "url": "https://www.moneycontrol.com/x"}
SUMMARY = {"facts": {"net_profit_cr": 40.0, "revenue_growth_pct": 30.0, "net_margin_pct": 12.0},
           "url": "https://groww.in/ipo/gem-ipo", "years": ["2023", "2024"]}


async def _noop(text):
    return {}


@pytest.mark.asyncio
async def test_web_search_is_used_only_after_the_document_and_the_summary_fail(db):
    db.add_all([_ipo("GEM1"), _ipo("GEM2")])
    await db.commit()
    asked = []

    async def web_finder(ipo):
        if not ipo.symbol.startswith("GEM"):
            return None                                                  # rows left behind by other tests
        asked.append(ipo.symbol)
        return WEB if ipo.symbol in ("GEM1", "GEM2") else None

    async def summary_finder(ipo):
        return SUMMARY if ipo.symbol == "GEM2" else None          # GEM2 has a summary, GEM1 has nothing else

    out = await run_nightly(db, extractor=_noop, summary_finder=summary_finder, web_finder=web_finder, max_chunks=5)
    assert asked == ["GEM1"] and out["web_fallbacks"] == 1 and out["summary_fallbacks"] >= 1
    res = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-GEM1"))).scalar_one()
    assert res.facts["facts_basis"] == "web_search" and res.facts["web_sources"][0]["url"].startswith("https://www.moneycontrol.com")
    ver = (await db.execute(select(AnalysisVersion).where(AnalysisVersion.ipo_id == "id-GEM1"))).scalar_one()
    assert ver.doc_kind == "WEB"


@pytest.mark.asyncio
async def test_web_lookups_are_budgeted_and_not_repeated_every_night(db):
    db.add_all([_ipo(f"GEM{i}") for i in range(3, 8)])
    await db.commit()
    asked = []

    async def web_finder(ipo):
        asked.append(ipo.symbol)
        return None                                              # nothing found anywhere

    out = await run_nightly(db, extractor=_noop, web_finder=web_finder, max_web_lookups=2, max_chunks=5)
    assert len(asked) == 2 and out["web_lookups"] == 2           # the budget holds, whichever IPOs were tried

    async def finds(ipo):
        return WEB

    await run_nightly(db, extractor=_noop, web_finder=finds, max_web_lookups=10, max_chunks=5)
    asked2 = []

    async def count(ipo):
        if ipo.symbol.startswith("GEM"):
            asked2.append(ipo.symbol)
        return WEB

    await run_nightly(db, extractor=_noop, web_finder=count, max_web_lookups=10, max_chunks=5)
    assert asked2 == []                                          # IPOs that already have a web result are not searched again


@pytest.mark.asyncio
async def test_a_deferred_document_does_not_trigger_a_web_search(db):
    db.add(_ipo("GEM9", rhp_url="https://www.sebi.gov.in/later.pdf"))
    await db.commit()
    asked = []

    async def web_finder(ipo):
        if ipo.symbol == "GEM9":
            asked.append(ipo.symbol)
        return None

    await run_nightly(db, extractor=_noop, web_finder=web_finder, max_chunks=0)
    assert asked == []                                           # the document exists; it will be read later


@pytest.mark.asyncio
async def test_a_web_result_is_replaced_by_the_document_later_and_shown_with_its_sources(db):
    db.add(_ipo("GEM10"))
    await db.commit()

    async def web_finder(ipo):
        return WEB if ipo.symbol == "GEM10" else None

    await run_nightly(db, extractor=_noop, web_finder=web_finder, max_chunks=5)
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "GEM10"))).scalar_one()
    res = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-GEM10"))).scalar_one()
    payload = _payload(ipo, res, False)
    assert payload["state"] == "web_only" and payload["facts_basis"] == "web_search"
    assert payload["sources"][0]["url"] == "https://www.moneycontrol.com/x"
    ipo.rhp_url = "https://www.sebi.gov.in/now.pdf"
    await db.commit()

    async def fetcher(url):
        return make_pdf(["Net profit is 50 crore"])

    async def extractor(text):
        return {"net_profit_cr": 50.0, "revenue_growth_pct": 20.0, "debt_to_equity": 0.5, "promoter_holding_post_pct": 70.0}

    await run_nightly(db, extractor=extractor, fetcher=fetcher, max_chunks=30, chunk_chars=40, chunk_overlap=0)
    rows = (await db.execute(select(AnalysisResult).where(AnalysisResult.ipo_id == "id-GEM10")
                             .order_by(AnalysisResult.created_at, AnalysisResult.id))).scalars().all()
    assert len(rows) == 2 and rows[0].facts["facts_basis"] == "web_search" and "facts_basis" not in rows[-1].facts
