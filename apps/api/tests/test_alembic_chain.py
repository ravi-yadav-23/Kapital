"""The migration chain must be linear and must include the score_history table."""
import re
from pathlib import Path

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def _revs():
    out = {}
    for p in VERSIONS.glob("*.py"):
        text = p.read_text(encoding="utf-8")
        rev = re.search(r"^revision[^=]*=\s*'([^']+)'", text, re.M)
        down = re.search(r"^down_revision[^=]*=\s*(None|'([^']+)')", text, re.M)
        if rev:
            out[rev.group(1)] = (down.group(2) if down and down.group(2) else None, text)
    return out


def test_chain_is_linear_with_a_single_head():
    revs = _revs()
    heads = [r for r in revs if all(d != r for d, _ in revs.values())]
    roots = [r for r, (d, _) in revs.items() if d is None]
    assert len(heads) == 1 and len(roots) == 1, (heads, roots)
    assert all(d in revs for d, _ in revs.values() if d), "dangling down_revision"


def test_score_history_migration_exists():
    assert any("create_table(\n        'score_history'" in text for _, text in _revs().values())


def test_snapshot_tables_have_a_migration():
    text = "\n".join(t for _, t in _revs().values())
    for table in ("gmp_snapshots", "subscription_snapshots", "ipo_outcomes"):
        assert f"'{table}'" in text, table
