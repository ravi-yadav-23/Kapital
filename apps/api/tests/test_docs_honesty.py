"""F20: README / docs / landing copy must not claim features, sources, models or numbers the code does not have."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

# claim -> why it is false (see AUDIT.md "Docs honesty")
FORBIDDEN = {
    r"SEBI EDGAR": "no SEBI integration exists (EDGAR is the US SEC system)",
    r"Chittorgarh": "not a data source in the code",
    r"InvestorGain": "not a data source in the code",
    r"PyPDF": "no PDF/DRHP parsing exists",
    r"400-page": "no prospectus is read",
    r"DRHP scraping": "no DRHP scraping exists",
    r"extract audited financials": "financials are not extracted",
    r"Claude Haiku": "no per-agent model assignment; provider is chosen globally",
    r"Gemini Flash-Lite": "no per-agent model assignment; provider is chosen globally",
    r"Claude 3\.5 Sonnet": "model is configurable; default is openai/gpt-oss-120b on Groq",
    r"Gemini 2\.5 Flash": "model is configurable; default is openai/gpt-oss-120b on Groq",
    r"LLaMA-3\.3-70B": "default model is openai/gpt-oss-120b",
    r"under ₹200": "AI cost is not measured",
    r"₹2\.00 per": "AI cost is not measured",
    r"Sub-50ms": "latency is not measured",
    r"exactly once": "the job lock is best-effort, not an exactly-once guarantee",
    r"mathematical certainty": "the optimizer is a heuristic, not a guarantee",
    r"SciPy": "scipy is never imported",
}


def _files():
    for name in ("README.md", "SETUP.md"):
        yield ROOT / name
    yield from (ROOT / "docs").rglob("*.md")
    for p in (ROOT / "apps" / "web" / "src").rglob("*"):
        if p.suffix in (".ts", ".tsx") and "__tests__" not in p.parts and p.name != "mock-data.ts":
            yield p


def test_no_known_false_claims_in_docs_or_ui():
    offenders = []
    for path in _files():
        if "plans" in path.parts:  # historical planning notes, not user-facing
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern, why in FORBIDDEN.items():
            for m in re.finditer(pattern, text):
                line = text.count("\n", 0, m.start()) + 1
                offenders.append(f"{path.relative_to(ROOT)}:{line}: '{m.group(0)}' ({why})")
    assert not offenders, "\n" + "\n".join(offenders)


def test_setup_guide_uses_real_variables():
    text = (ROOT / "SETUP.md").read_text(encoding="utf-8")
    if "ADMIN_PIN" in text:
        assert "legacy" in text.lower(), "ADMIN_PIN is not used for login; SETUP.md must say it is legacy"
    for var in ("GOOGLE_CLIENT_ID", "ALLOWED_EMAIL", "ADMIN_TOTP_SECRET", "CRON_SECRET"):
        assert var in text, f"SETUP.md must document {var}"


def test_node_version_matches_what_the_tests_need():
    for name in ("README.md", "SETUP.md"):
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "Node.js 18" not in text and "v18" not in text, f"{name}: web tests need Node 22+"
