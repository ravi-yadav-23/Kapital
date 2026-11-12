"""
IPO market-momentum scoring facade.

The formula lives in app.utils.scoring (single source of truth). This class keeps the old entry point
used by the sync tasks. The score is None until real GMP or subscription data exists.
"""

from typing import Dict, Any, Optional, Tuple

from app.utils.scoring import momentum_score, recommendation_for


class IpoScoreEngine:
    """Market-momentum scoring (GMP + subscription). See app.utils.scoring."""

    @classmethod
    def compute_score(cls, raw: Dict[str, Any]) -> Tuple[Optional[int], str, float]:
        """Returns (score or None, recommendation, normalized GMP %).

        Delegates to app.utils.scoring so every code path uses the same formula. The score is None
        ("No score yet") until real GMP or subscription data exists. Keyword scoring of scraped
        strengths/risks and issue-size points were removed: they rewarded size and marketing language,
        not listing-day demand.
        """
        gmp_pct = 0.0
        raw_gmp = raw.get("gmp_percent") or raw.get("gmp") or raw.get("gmpPercent")
        if raw_gmp is not None:
            try:
                gmp_pct = float(str(raw_gmp).replace("%", "").replace("₹", "").strip())
            except Exception:
                gmp_pct = 0.0
        score = momentum_score(
            gmp_pct,
            float(raw.get("subscription_qib") or 0.0),
            float(raw.get("subscription_total") or 0.0),
        )
        return score, recommendation_for(score), gmp_pct
