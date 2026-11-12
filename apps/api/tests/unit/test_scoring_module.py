"""M1: one scoring module. A score exists only when there is real market data."""
import pytest

from app.utils.score_engine import IpoScoreEngine
from app.utils.scoring import (
    gmp_strength,
    momentum_score,
    recommendation_for,
    subscription_momentum,
)


def test_no_market_data_means_no_score():
    assert momentum_score(None, 0.0, 0.0) is None
    assert momentum_score(0.0, 0.0, 0.0) is None
    assert momentum_score(None, None, None) is None


def test_gmp_only_uses_gmp_alone():
    assert gmp_strength(20.0) == 60
    assert momentum_score(20.0, 0.0, 0.0) == 60


def test_subscription_only_uses_subscription_alone():
    assert subscription_momentum(3.0) == 50
    assert momentum_score(None, 0.0, 3.0) == 50


def test_both_signals_are_blended_60_40():
    assert momentum_score(20.0, 1.0, 3.0) == round(60 * 0.6 + 50 * 0.4)


def test_negative_gmp_is_a_real_signal_not_missing():
    assert gmp_strength(-10.0) == 15
    assert momentum_score(-10.0, 0.0, 0.0) == 15


@pytest.mark.parametrize("gmp,expected", [(50.0, 80), (35.0, 70), (10.0, 46), (2.0, 31)])
def test_gmp_strength_bands(gmp, expected):
    assert gmp_strength(gmp) == expected


@pytest.mark.parametrize("score,rec", [
    (None, "PENDING"), (95, "STRONG_APPLY"), (80, "STRONG_APPLY"), (79, "MODERATE_APPLY"),
    (62, "MODERATE_APPLY"), (61, "WATCH"), (45, "WATCH"), (44, "AVOID"), (0, "AVOID"),
])
def test_one_set_of_thresholds(score, rec):
    assert recommendation_for(score) == rec


def test_engine_delegates_to_the_single_module():
    raw = {"gmp_percent": 20.0, "subscription_qib": 1.0, "subscription_total": 3.0, "issue_size_cr": 900.0,
           "strengths": ["market leader", "debt free"], "risks": ["litigation"]}
    score, rec, gmp = IpoScoreEngine.compute_score(raw)
    assert score == momentum_score(20.0, 1.0, 3.0)
    assert rec == recommendation_for(score)
    assert gmp == 20.0


def test_engine_returns_no_score_without_market_data():
    score, rec, _ = IpoScoreEngine.compute_score(
        {"gmp_percent": 0.0, "subscription_qib": 0.0, "subscription_total": 0.0, "issue_size_cr": 500.0,
         "strengths": ["market leader"], "risks": []})
    assert score is None and rec == "PENDING"
