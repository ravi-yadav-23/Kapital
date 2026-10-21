import re
import html
from typing import Optional, List, Union


def clean_text(raw: Optional[str]) -> str:
    """
    Cleans and sanitizes raw text by stripping HTML tags, TinyMCE bookmark spans,
    zero-width characters, non-breaking spaces, and unescaping HTML entities.
    """
    if not raw or not isinstance(raw, str):
        return ""

    text = raw

    # 1. Strip TinyMCE / WYSIWYG selection bookmark tags completely
    text = re.sub(
        r'<span[^>]*data-mce-type=["\']?bookmark["\']?[^>]*>.*?</span>',
        '',
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    text = re.sub(
        r'<span[^>]*class=["\']?[^"\']*mce_SELRES_[^"\']*["\']?[^>]*>.*?</span>',
        '',
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    # 2. Decode HTML entities (e.g. &nbsp;, &#xFEFF;, &amp;)
    text = html.unescape(text)

    # 3. Remove zero-width characters and BOM
    text = re.sub(r'[\ufeff\u200b\u200c\u200d\xa0]', ' ', text)

    # 4. Strip any remaining HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)

    # 5. Collapse multiple whitespaces and trim
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    return text.strip()


def clean_text_list(items: Optional[Union[List[str], str]]) -> List[str]:
    """Cleans a list of text items, filtering out empty or whitespace-only entries."""
    if not items:
        return []
    if isinstance(items, str):
        cleaned = clean_text(items)
        return [cleaned] if cleaned else []
    
    cleaned_items = []
    for item in items:
        cleaned = clean_text(str(item))
        if cleaned:
            cleaned_items.append(cleaned)
    return cleaned_items
