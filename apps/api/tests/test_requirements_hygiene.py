"""Dependencies that nothing imports must not be pinned (scipy 1.14.0 has no Python 3.13 wheel and is unused)."""
import re
from pathlib import Path

API = Path(__file__).resolve().parents[1]


def _imported(module: str) -> bool:
    pat = re.compile(rf"^\s*(import|from)\s+{module}\b", re.M)
    return any(pat.search(p.read_text(encoding="utf-8", errors="ignore")) for p in (API / "app").rglob("*.py"))


def _declared(text: str, name: str) -> bool:
    return re.search(rf"^\s*\"?{name}\b", text, re.M | re.I) is not None


def test_unused_scientific_stack_is_not_declared():
    req = (API / "requirements.txt").read_text(encoding="utf-8")
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")
    for module in ("scipy", "numpy"):
        if not _imported(module):
            assert not _declared(req, module), f"{module} is pinned in requirements.txt but never imported"
            assert not _declared(pyproject, module), f"{module} is listed in pyproject.toml but never imported"
