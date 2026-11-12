"""
Single source of truth for the market-momentum score and the recommendation bands.

Every endpoint (IPO list, report page, optimizer, audited report components) must use these
functions so the same IPO never shows two different scores.

A score exists only when there is real market data. With no GMP and no subscription numbers
the answer is None ("No score yet") - never a made-up neutral number.
"""
from typing import Optional


def gmp_known(gmp_percent: Optional[float]) -> bool:
    """GMP 0 / None means 'no grey-market quote' (feeds report 0 when they have none)."""
    return gmp_percent is not None and float(gmp_percent) != 0.0


def subscription_known(subscription_total: Optional[float], subscription_qib: Optional[float] = None) -> bool:
    return float(subscription_total or 0.0) > 0.0 or float(subscription_qib or 0.0) > 0.0


def gmp_strength(gmp_percent: float) -> int:
    """GMP as % of issue price -> 0..100."""
    gmp = float(gmp_percent)
    if gmp >= 50.0:
        return min(100, int(80 + (gmp - 50) * 0.4))
    if gmp >= 20.0:
        return int(60 + (gmp - 20) * (20 / 30))
    if gmp >= 5.0:
        return int(40 + (gmp - 5) * (20 / 15))
    if gmp >= 0.0:
        return int(25 + gmp * 3)
    return max(0, int(25 + gmp))


def subscription_momentum(subscription_total: float) -> int:
    """Total subscription multiple -> 0..100."""
    sub = float(subscription_total or 0.0)
    if sub >= 20.0:
        return min(100, int(80 + (sub - 20) * 0.5))
    if sub >= 5.0:
        return int(60 + (sub - 5) * (20 / 15))
    if sub >= 1.0:
        return int(40 + (sub - 1) * 5)
    return 30  # subscribed, but under 1x


def momentum_score(
    gmp_percent: Optional[float],
    subscription_qib: Optional[float],
    subscription_total: Optional[float],
) -> Optional[int]:
    """Market-momentum score (0..100) or None when there is no market data at all.

    GMP 60% / subscription 40% when both exist; the available signal alone otherwise.
    """
    has_gmp = gmp_known(gmp_percent)
    has_sub = subscription_known(subscription_total, subscription_qib)
    if not has_gmp and not has_sub:
        return None
    if has_gmp and has_sub:
        total = float(subscription_total or 0.0) or float(subscription_qib or 0.0)
        return int(round(gmp_strength(gmp_percent) * 0.60 + subscription_momentum(total) * 0.40))
    if has_gmp:
        return gmp_strength(gmp_percent)
    total = float(subscription_total or 0.0) or float(subscription_qib or 0.0)
    return subscription_momentum(total)


def recommendation_for(score: Optional[int]) -> str:
    """One set of bands, shared with the frontend (80 / 62 / 45)."""
    if score is None:
        return "PENDING"
    if score >= 80:
        return "STRONG_APPLY"
    if score >= 62:
        return "MODERATE_APPLY"
    if score >= 45:
        return "WATCH"
    return "AVOID"
