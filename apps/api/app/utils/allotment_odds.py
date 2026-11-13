"""Allotment odds and expected value per rupee bid, per investor category (pure functions)."""
from typing import Any, Dict, Tuple

GMP_CAP = 80.0     # guard against a pumped grey-market quote
GMP_FLOOR = -50.0

_CATEGORY_FIELD = {"RETAIL": "subscription_retail", "sHNI": "subscription_shni", "bHNI": "subscription_bhni"}


def allotment_probability(category: str, ipo: Dict[str, Any]) -> Tuple[float, bool]:
    """(probability that a bid gets shares, known). Uses the category's own subscription multiple,
    then the overall multiple. Unknown subscription returns (1.0, False) so callers can say so."""
    multiple = float(ipo.get(_CATEGORY_FIELD.get(category, "")) or 0.0)
    if multiple <= 0:
        multiple = float(ipo.get("subscription_total") or 0.0)
    if multiple <= 0:
        return 1.0, False
    return (1.0 if multiple <= 1.0 else 1.0 / multiple), True


def expected_gain_percent(ipo: Dict[str, Any]) -> float:
    """Expected listing gain in % from the (capped) grey-market premium; 0 when there is no quote."""
    gmp = ipo.get("gmp_percent")
    if gmp is None:
        return 0.0
    return max(GMP_FLOOR, min(float(gmp), GMP_CAP))


def expected_value_per_rupee(category: str, ipo: Dict[str, Any]) -> float:
    p, _ = allotment_probability(category, ipo)
    return p * expected_gain_percent(ipo) / 100.0
