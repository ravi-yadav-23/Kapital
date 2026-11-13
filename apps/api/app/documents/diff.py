"""Compare facts extracted from two versions of an offer document (e.g. DRHP vs RHP)."""
from typing import Any, Dict, List


def diff_facts(old: Dict[str, Any], new: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for key in sorted(set(old) | set(new)):
        a, b = old.get(key), new.get(key)
        if a == b:
            continue
        entry: Dict[str, Any] = {"fact": key, "old": a, "new": b}
        if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and a:
            entry["change_pct"] = round((b - a) / abs(a) * 100.0, 2)
        out.append(entry)
    return out
