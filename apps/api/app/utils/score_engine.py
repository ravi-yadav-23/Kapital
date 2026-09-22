"""
Algorithmic Multi-Factor IPO Scoring Engine
Calculates preliminary fundamental ratings, grey market premium estimates,
and recommendation signals before deep LLM due diligence is triggered.
"""

from typing import Dict, Any, Tuple


class IpoScoreEngine:
    """
    Evaluates an IPO issue using a 5-dimension quantitative & qualitative weighted model:
    1. GMP Strength & Market Demand (30%)
    2. Institutional / QIB Backing (25%)
    3. Issue Size & Liquidity Structure (15%)
    4. Business Profile & Qualitative Factors (15%)
    5. Risk / Controversy Penalties (15%)
    """

    @classmethod
    def compute_score(cls, raw: Dict[str, Any]) -> Tuple[int, str, float]:
        """
        Computes score (0-100), recommendation enum, and normalized GMP%.
        """
        # 1. GMP Extraction
        gmp_pct = 0.0
        raw_gmp = raw.get("gmp_percent") or raw.get("gmp") or raw.get("gmpPercent")
        if raw_gmp is not None:
            try:
                gmp_pct = float(str(raw_gmp).replace("%", "").replace("₹", "").strip())
            except Exception:
                gmp_pct = 0.0

        # GMP component (0 - 30 points)
        if gmp_pct >= 50.0:
            gmp_points = 30
        elif gmp_pct >= 30.0:
            gmp_points = 25
        elif gmp_pct >= 15.0:
            gmp_points = 18
        elif gmp_pct >= 5.0:
            gmp_points = 10
        elif gmp_pct >= 0.0:
            gmp_points = 5
        else:
            gmp_points = 0  # Discount listing risk

        # 2. Institutional (QIB) & Subscription Momentum (0 - 25 points)
        sub_qib = float(raw.get("subscription_qib") or 0.0)
        sub_total = float(raw.get("subscription_total") or 0.0)
        sub_points = 0
        if sub_qib >= 20.0 or sub_total >= 30.0:
            sub_points = 25
        elif sub_qib >= 10.0 or sub_total >= 15.0:
            sub_points = 20
        elif sub_qib >= 3.0 or sub_total >= 5.0:
            sub_points = 15
        elif sub_qib >= 1.0 or sub_total >= 1.5:
            sub_points = 10
        else:
            # Neutral baseline before subscription opens
            sub_points = 12

        # 3. Issue Size & Pricing Safety (0 - 20 points)
        issue_cr = float(raw.get("issue_size_cr") or 0.0)
        size_points = 0
        if issue_cr > 2000:
            size_points = 18  # Large liquid mainboard issue
        elif issue_cr >= 500:
            size_points = 16  # Optimal mid-cap issue
        elif issue_cr >= 100:
            size_points = 14
        elif issue_cr > 0:
            size_points = 10  # Micro/SME issue liquidity discount
        else:
            size_points = 12

        # 4. Qualitative Strengths & Peer Standing (0 - 15 points)
        strengths = raw.get("strengths") or []
        num_strengths = len(strengths) if isinstance(strengths, list) else 0
        quality_points = min(15, 6 + (num_strengths * 2))

        # 5. Risk / Red Flag Penalties (0 - 10 deduction)
        risks = raw.get("risks") or []
        num_risks = len(risks) if isinstance(risks, list) else 0
        risk_penalty = min(15, num_risks * 3)

        # Sum of weighted dimensions
        total_score = gmp_points + sub_points + size_points + quality_points - risk_penalty
        final_score = max(20, min(98, total_score))

        # Recommendation mapping
        if final_score >= 78:
            rec = "STRONG_APPLY"
        elif final_score >= 62:
            rec = "MODERATE_APPLY"
        elif final_score >= 45:
            rec = "WATCH"
        else:
            rec = "AVOID"

        return final_score, rec, gmp_pct
