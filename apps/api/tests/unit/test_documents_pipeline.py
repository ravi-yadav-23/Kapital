"""M6: offer-document pipeline - fetch (safely), extract, chunk, store append-only, analyse chunk by chunk."""
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.documents.extract import pdf_to_pages, chunk_pages
from app.documents.fetch import fetch_document, is_allowed_url, DocumentError
from app.documents.diff import diff_facts
from app.documents.store import store_document, analyse_pending_chunks
from app.models.analysis import AnalysisVersion, AnalysisChunk


def make_pdf(pages):
    """Minimal valid PDF with one line of text per page."""
    objs, kids = [], []
    n = 3 + 2 * len(pages)
    objs.append("<< /Type /Catalog /Pages 2 0 R >>")
    objs.append("<< /Type /Pages /Kids [" + " ".join(f"{4 + 2 * i} 0 R" for i in range(len(pages))) + f"] /Count {len(pages)} >>")
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i, text in enumerate(pages):
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET"
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {5 + 2 * i} 0 R /Resources << /Font << /F1 3 0 R >> >> >>")
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
    out, offsets = "%PDF-1.4\n", []
    for i, o in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1")


def test_pdf_text_is_extracted_per_page():
    pages = pdf_to_pages(make_pdf(["Risk factors page one", "Objects of the issue page two"]))
    assert len(pages) == 2 and "Risk factors" in pages[0] and "Objects of the issue" in pages[1]


def test_garbage_is_not_a_pdf():
    with pytest.raises(DocumentError):
        pdf_to_pages(b"<html>not a pdf</html>")


def test_chunks_cover_text_with_page_ranges_and_stable_hashes():
    pages = ["A" * 700, "B" * 700, "C" * 700]
    chunks = chunk_pages(pages, max_chars=1000, overlap=100)
    assert len(chunks) >= 3
    assert chunks[0]["page_start"] == 1 and chunks[-1]["page_end"] == 3
    assert [c["index"] for c in chunks] == list(range(len(chunks)))
    assert chunk_pages(pages, max_chars=1000, overlap=100)[1]["sha256"] == chunks[1]["sha256"]
    assert "".join(c["text"] for c in chunks).count("A") >= 700


def test_url_policy_is_https_and_official_hosts_only():
    assert is_allowed_url("https://www.sebi.gov.in/filings/x.pdf")
    assert is_allowed_url("https://nsearchives.nseindia.com/a.pdf")
    assert not is_allowed_url("http://www.sebi.gov.in/x.pdf")            # not https
    assert not is_allowed_url("https://evil.example.com/x.pdf")           # not allow-listed
    assert not is_allowed_url("https://127.0.0.1/x.pdf")
    assert not is_allowed_url("https://sebi.gov.in.evil.com/x.pdf")       # look-alike host
    assert not is_allowed_url("file:///etc/passwd")


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_fetch_returns_pdf_bytes():
    pdf = make_pdf(["hello"])
    async with _client(lambda r: httpx.Response(200, content=pdf, headers={"content-type": "application/pdf"})) as c:
        assert await fetch_document("https://www.sebi.gov.in/a.pdf", client=c) == pdf


@pytest.mark.asyncio
async def test_fetch_follows_pdf_link_on_a_filing_page():
    pdf = make_pdf(["hello"])

    def handler(req):
        if req.url.path.endswith(".pdf"):
            return httpx.Response(200, content=pdf, headers={"content-type": "application/pdf"})
        return httpx.Response(200, text='<html><a href="/sebi_data/attachdocs/drhp.pdf">DRHP</a></html>',
                              headers={"content-type": "text/html"})
    async with _client(handler) as c:
        assert await fetch_document("https://www.sebi.gov.in/filings/public-issues/x.html", client=c) == pdf


@pytest.mark.asyncio
async def test_fetch_rejects_disallowed_host_oversize_and_errors():
    async with _client(lambda r: httpx.Response(200, content=b"x")) as c:
        with pytest.raises(DocumentError):
            await fetch_document("https://evil.example.com/a.pdf", client=c)
    big = b"%PDF" + b"0" * 2000
    async with _client(lambda r: httpx.Response(200, content=big, headers={"content-type": "application/pdf"})) as c:
        with pytest.raises(DocumentError):
            await fetch_document("https://www.sebi.gov.in/a.pdf", client=c, max_bytes=1000)
    async with _client(lambda r: httpx.Response(404)) as c:
        with pytest.raises(DocumentError):
            await fetch_document("https://www.sebi.gov.in/a.pdf", client=c)


def test_diff_facts_reports_changes_only():
    d = diff_facts({"price_band_max": 100, "net_profit_cr": 40, "ofs_share_pct": 50, "same": 1},
                   {"price_band_max": 120, "net_profit_cr": 40, "ofs_share_pct": 80, "same": 1, "new": 5})
    changed = {x["fact"]: x for x in d}
    assert set(changed) == {"price_band_max", "ofs_share_pct", "new"}
    assert changed["price_band_max"]["old"] == 100 and changed["price_band_max"]["new"] == 120
    assert changed["new"]["old"] is None


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        await s.execute(delete(AnalysisChunk))
        await s.execute(delete(AnalysisVersion))
        await s.commit()


def _chunks(n):
    return chunk_pages([f"page {i} " + "x" * 900 for i in range(n)], max_chars=1000, overlap=0)


@pytest.mark.asyncio
async def test_store_is_versioned_and_idempotent(db):
    v1 = await store_document(db, "ipo-1", "DRHP", "https://www.sebi.gov.in/a.pdf", "sha-a", _chunks(3))
    again = await store_document(db, "ipo-1", "DRHP", "https://www.sebi.gov.in/a.pdf", "sha-a", _chunks(3))
    assert again.id == v1.id and v1.version == 1                      # same document -> no new version
    v2 = await store_document(db, "ipo-1", "DRHP", "https://www.sebi.gov.in/a.pdf", "sha-b", _chunks(2))
    assert v2.version == 2
    # nothing is ever deleted: both versions and all their chunks remain
    assert len((await db.execute(select(AnalysisVersion))).scalars().all()) == 2
    assert len((await db.execute(select(AnalysisChunk).where(AnalysisChunk.version_id == v1.id))).scalars().all()) == 3


@pytest.mark.asyncio
async def test_each_finished_chunk_is_saved_and_failures_do_not_stop_the_run(db):
    v = await store_document(db, "ipo-2", "RHP", "https://www.sebi.gov.in/b.pdf", "sha-c", _chunks(4))
    calls = []

    async def llm(chunk_text):
        calls.append(chunk_text)
        if len(calls) == 2:
            raise RuntimeError("rate limited")
        return {"net_profit_cr": 10.0 * len(calls)}

    res = await analyse_pending_chunks(db, v.id, llm)
    assert res == {"done": 3, "failed": 1, "remaining": 0}
    rows = (await db.execute(select(AnalysisChunk).where(AnalysisChunk.version_id == v.id)
                             .order_by(AnalysisChunk.chunk_index))).scalars().all()
    assert [r.status for r in rows] == ["done", "failed", "done", "done"]
    assert rows[0].facts == {"net_profit_cr": 10.0}


@pytest.mark.asyncio
async def test_budget_limits_chunks_and_next_run_resumes(db):
    v = await store_document(db, "ipo-3", "RHP", "https://www.sebi.gov.in/c.pdf", "sha-d", _chunks(5))

    async def llm(text):
        return {"k": 1}

    first = await analyse_pending_chunks(db, v.id, llm, max_chunks=2)
    assert first == {"done": 2, "failed": 0, "remaining": 3}
    second = await analyse_pending_chunks(db, v.id, llm, max_chunks=10)
    assert second == {"done": 3, "failed": 0, "remaining": 0}
