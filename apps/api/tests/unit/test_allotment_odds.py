"""M5: expected value = P(allotment) x expected listing gain, per category - used by the optimizer."""
from app.utils.allotment_odds import allotment_probability, expected_gain_percent, expected_value_per_rupee


def test_undersubscribed_category_is_certain():
    assert allotment_probability("RETAIL", {"subscription_retail": 0.8}) == (1.0, True)


def test_oversubscribed_category_gets_one_over_multiple():
    p, known = allotment_probability("RETAIL", {"subscription_retail": 20.0})
    assert known and abs(p - 0.05) < 1e-9
    p, _ = allotment_probability("bHNI", {"subscription_bhni": 50.0, "subscription_total": 5.0})
    assert abs(p - 0.02) < 1e-9


def test_falls_back_to_total_then_unknown():
    p, known = allotment_probability("sHNI", {"subscription_total": 4.0})
    assert known and abs(p - 0.25) < 1e-9
    p, known = allotment_probability("RETAIL", {})
    assert p == 1.0 and known is False  # unknown is reported, not hidden


def test_expected_gain_uses_capped_gmp_and_zero_when_unknown():
    assert expected_gain_percent({"gmp_percent": 120.0}) == 80.0   # pump guard
    assert expected_gain_percent({"gmp_percent": None}) == 0.0
    assert expected_gain_percent({"gmp_percent": -10.0}) == -10.0


def test_hot_but_oversubscribed_ipo_loses_to_modest_but_open_ipo():
    hot = {"gmp_percent": 60.0, "subscription_retail": 100.0}      # 1% odds
    modest = {"gmp_percent": 10.0, "subscription_retail": 0.9}     # certain allotment
    assert expected_value_per_rupee("RETAIL", modest) > expected_value_per_rupee("RETAIL", hot)
