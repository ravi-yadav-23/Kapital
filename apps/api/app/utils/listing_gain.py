"""Listing-Gain Engine v1.1: how likely is a gain on listing day?  (buy in the IPO, sell on day one)

Pure functions, no I/O. Design rules (see docs/plans/2026-11-12-ai-reports-redesign.md section 15):
  * GMP is only 20% of the score and is discounted when subscription demand does not back it
    (GMP can be manipulated; subscription and company reality are harder to fake).
  * A critical red flag is a veto; high / medium flags subtract points.
  * Missing inputs are left out and the weights renormalised - never replaced by invented numbers.
  * Thin evidence (fewer than two of company / demand / GMP) stays in the Watch band: it can neither recommend nor reject.
"""
from typing import Any, Dict, Iterable, List, Optional

from app.utils.scoring import (
    gmp_known, subscription_known, gmp_strength, subscription_momentum, recommendation_for,
)

WEIGHTS = {"company": 0.30, "demand": 0.30, "gmp": 0.20, "float": 0.10, "market": 0.10}
CORE = ("company", "demand", "gmp")
THIN_EVIDENCE_CAP = 60
THIN_EVIDENCE_FLOOR = 45   # one signal alone cannot reject an IPO (a verified critical flag still can)
CRITICAL_CAP = 35
HIGH_PENALTY, MEDIUM_PENALTY, MAX_PENALTY = 10, 4, 25
GMP_DEMAND_TOLERANCE = 30   # GMP strength may exceed demand strength by this much before it is discounted
GMP_DEMAND_ALLOWANCE = 15   # ... and is then capped at demand + this


def _signal(code: str, direction: str, reason: str) -> Dict[str, str]:
    return {"code": code, "direction": direction, "reason": reason}


def _float_score(issue_size_cr: Optional[float]) -> Optional[int]:
    if not issue_size_cr or issue_size_cr <= 0:
        return None
    if issue_size_cr < 250:
        return 70
    if issue_size_cr < 1000:
        return 60
    if issue_size_cr < 5000:
        return 50
    return 35


def _demand_score(total: Optional[float], qib: Optional[float]) -> Optional[int]:
    if not subscription_known(total, qib):
        return None
    t, q = float(total or 0.0), float(qib or 0.0)
    if t > 0 and q > 0:
        return int(round((subscription_momentum(t) + subscription_momentum(q)) / 2))
    return subscription_momentum(t or q)


def listing_gain_engine(
    *,
    gmp_percent: Optional[float] = None,
    subscription_total: Optional[float] = None,
    subscription_qib: Optional[float] = None,
    subscription_retail: Optional[float] = None,
    issue_size_cr: Optional[float] = None,
    company_score: Optional[float] = None,
    market_regime: Optional[float] = None,
    red_flags: Iterable[Dict[str, Any]] = (),
) -> Dict[str, Any]:
    """Returns {score, verdict, confidence, components, signals}. score is None when nothing is known."""
    flags = [f for f in (red_flags or [])]
    signals: List[Dict[str, str]] = []
    raw: Dict[str, Optional[float]] = {
        "company": float(company_score) if company_score is not None else None,
        "demand": _demand_score(subscription_total, subscription_qib),
        "gmp": gmp_strength(gmp_percent) if gmp_known(gmp_percent) else None,
        "float": _float_score(issue_size_cr),
        "market": float(market_regime) if market_regime is not None else None,
    }

    # critical flags are reported first, whatever else is known
    critical = [f for f in flags if f.get("severity") == "critical"]
    for f in critical:
        signals.append(_signal(f.get("code", "red_flag"), "negative", f"Critical red flag: {f.get('reason', '')}".strip()))

    # GMP must be backed by real demand
    if raw["gmp"] is not None and raw["demand"] is not None and raw["gmp"] > raw["demand"] + GMP_DEMAND_TOLERANCE:
        raw["gmp"] = raw["demand"] + GMP_DEMAND_ALLOWANCE
        signals.append(_signal("gmp_unbacked", "negative",
                               "Grey-market premium is not backed by subscription demand; its weight was reduced."))

    available = {k: v for k, v in raw.items() if v is not None}
    if not available:
        return {"score": None, "verdict": "PENDING", "confidence": "none", "components": {}, "signals": signals}

    total_weight = sum(WEIGHTS[k] for k in available)
    components = {k: {"value": round(v, 1), "weight": round(WEIGHTS[k] / total_weight, 3)} for k, v in available.items()}
    score = sum(v * WEIGHTS[k] for k, v in available.items()) / total_weight

    core_count = sum(1 for k in CORE if k in available)
    confidence = "high" if core_count >= 3 else "medium" if core_count == 2 else "low"
    if core_count < 2:
        score = min(score, THIN_EVIDENCE_CAP)
        signals.append(_signal("thin_evidence", "neutral",
                               "Only one of company quality / demand / grey market is known: the score is kept inside the Watch band "
                               "(it can neither recommend nor reject) until more is known."))

    # explain the positive / negative drivers
    if raw["demand"] is not None:
        d = raw["demand"]
        extra = f" (retail {float(subscription_retail):.1f}x)" if subscription_retail else ""
        signals.append(_signal("demand", "positive" if d >= 62 else "negative" if d < 45 else "neutral",
                               f"Subscription demand scores {d:.0f}/100{extra}."))
    if raw["gmp"] is not None:
        g = raw["gmp"]
        signals.append(_signal("gmp", "positive" if g >= 62 else "negative" if g < 45 else "neutral",
                               f"Grey-market premium scores {g:.0f}/100 and carries at most {int(WEIGHTS['gmp'] * 100)}% of the weight."))
    if raw["company"] is not None:
        c = raw["company"]
        signals.append(_signal("company", "positive" if c >= 62 else "negative" if c < 45 else "neutral",
                               f"Company fundamentals score {c:.0f}/100."))
    if raw["float"] is not None:
        signals.append(_signal("float", "positive" if raw["float"] >= 60 else "neutral",
                               f"Issue size of Rs {float(issue_size_cr):.0f} cr gives a float score of {raw['float']:.0f}."))

    # red-flag penalties and veto
    penalty = 0
    for f in flags:
        sev = f.get("severity")
        if sev == "high":
            penalty += HIGH_PENALTY
        elif sev == "medium":
            penalty += MEDIUM_PENALTY
        if sev in ("high", "medium"):
            signals.append(_signal(f.get("code", "red_flag"), "negative", f"{sev.title()} red flag: {f.get('reason', '')}".strip()))
    score -= min(penalty, MAX_PENALTY)
    if critical:
        score = min(score, CRITICAL_CAP)
    elif core_count < 2:
        score = max(score, THIN_EVIDENCE_FLOOR)   # thin evidence cannot reject

    final = max(0, min(100, int(round(score))))
    return {"score": final, "verdict": recommendation_for(final), "confidence": confidence,
            "components": components, "signals": signals}


def _stats(picks: List[float]) -> Dict[str, Any]:
    n = len(picks)
    return {
        "apply_count": n,
        "apply_hit_rate": (sum(1 for g in picks if g > 0) / n) if n else None,
        "avg_gain_if_applied": (sum(picks) / n) if n else None,
    }


def backtest(outcomes: Iterable[Dict[str, Any]], apply_threshold: int = 62) -> Dict[str, Any]:
    """Compare the engine with a GMP-only rule on past listings (`ipo_outcomes` rows as dicts).

    "Apply" means score >= apply_threshold. Listings with neither GMP nor subscription are skipped.
    """
    engine_picks: List[float] = []
    gmp_picks: List[float] = []
    evaluated = skipped = 0
    for o in outcomes:
        gmp, sub = o.get("last_gmp_percent"), o.get("last_subscription_total")
        if not gmp_known(gmp) and not subscription_known(sub):
            skipped += 1
            continue
        evaluated += 1
        gain = float(o["listing_gain_percent"])
        res = listing_gain_engine(gmp_percent=gmp, subscription_total=sub)
        if res["score"] is not None and res["score"] >= apply_threshold:
            engine_picks.append(gain)
        if gmp_known(gmp) and gmp_strength(gmp) >= apply_threshold:
            gmp_picks.append(gain)
    return {"evaluated": evaluated, "skipped_no_data": skipped,
            "engine": _stats(engine_picks), "gmp_only": _stats(gmp_picks)}
