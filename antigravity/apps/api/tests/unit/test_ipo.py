import pytest
from app.utils.score_engine import IpoScoreEngine


def test_ipo_score_engine_high_demand():
    raw = {
        "gmp_percent": 55.0,
        "subscription_qib": 25.0,
        "subscription_total": 35.0,
        "issue_size_cr": 1500.0,
        "strengths": ["High growth", "Market leader", "Zero debt"],
        "risks": ["Forex risk"],
    }
    score, rec, gmp = IpoScoreEngine.compute_score(raw)
    assert score >= 75
    assert rec in ["STRONG_APPLY", "MODERATE_APPLY"]
    assert gmp == 55.0


def test_ipo_score_engine_low_demand_and_penalties():
    raw = {
        "gmp_percent": -5.0,
        "subscription_qib": 0.1,
        "subscription_total": 0.3,
        "issue_size_cr": 45.0,
        "strengths": [],
        "risks": ["Heavy debt", "Customer concentration", "Litigation", "Negative cash flows"],
    }
    score, rec, gmp = IpoScoreEngine.compute_score(raw)
    assert score <= 50
    assert rec in ["WATCH", "AVOID"]
