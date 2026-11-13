"""PDF text extraction and chunking (pure, offline)."""
import hashlib
import io
from typing import Any, Dict, List

from app.documents.errors import DocumentError


def pdf_to_pages(data: bytes) -> List[str]:
    """Text of each page. Raises DocumentError for anything that is not a readable PDF."""
    from pypdf import PdfReader
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise DocumentError("PDF is password protected")
        return [(page.extract_text() or "") for page in reader.pages]
    except DocumentError:
        raise
    except Exception as exc:
        raise DocumentError(f"not a readable PDF ({type(exc).__name__})") from exc


def chunk_pages(pages: List[str], max_chars: int = 6000, overlap: int = 300) -> List[Dict[str, Any]]:
    """Split page text into overlapping chunks that remember their page range and content hash."""
    if max_chars <= overlap:
        raise ValueError("max_chars must be larger than overlap")
    text, starts = "", []
    for page in pages:
        starts.append(len(text))
        text += page + "\n"
    text = text[:-1] if text else text

    def page_of(offset: int) -> int:
        n = 1
        for i, s in enumerate(starts, start=1):
            if s <= offset:
                n = i
        return n

    chunks: List[Dict[str, Any]] = []
    pos = 0
    while pos < len(text):
        end = min(len(text), pos + max_chars)
        body = text[pos:end]
        chunks.append({
            "index": len(chunks), "text": body,
            "page_start": page_of(pos), "page_end": page_of(max(pos, end - 1)),
            "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        })
        if end >= len(text):
            break
        pos = end - overlap
    return chunks
