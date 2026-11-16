"""M4: Listing-Gain Engine v1.1 - GMP cannot dominate, red flags veto, thin evidence is capped."""
from app.utils.listing_gain import listing_gain_engine, backtest


def _flag(sev, code="x"):
    return {"code": code, "severity": sev, "reason": f"{code} problem"}


def test_no_data_means_no_score():
    r = listing_gain_engine()
    assert r["score"] is None and r["verdict"] == "PENDING" and r["confidence"] == "none"


def test_gmp_alone_cannot_reach_apply_tier():
    r = listing_gain_engine(gmp_percent=90.0)
    assert r["score"] is not None and r["score"] <= 60
    assert r["verdict"] in ("WATCH", "AVOID", "PENDING")
    assert r["confidence"] == "low"


def test_gmp_not_backed_by_demand_is_discounted():
    backed = listing_gain_engine(gmp_percent=60.0, subscription_total=40.0, subscription_qib=80.0, company_score=75)
    hollow = listing_gain_engine(gmp_percent=60.0, subscription_total=0.8, subscription_qib=0.3, company_score=75)
    assert hollow["score"] < backed["score"] - 15
    assert any("not backed" in s["reason"].lower() for s in hollow["signals"])


def test_weights_give_gmp_no_more_than_twenty_percent():
    base = dict(subscription_total=10.0, subscription_qib=12.0, company_score=70, issue_size_cr=400.0)
    lo = listing_gain_engine(gmp_percent=0.5, **base)["score"]
    hi = listing_gain_engine(gmp_percent=60.0, **base)["score"]
    assert 0 < hi - lo <= 22  # whole GMP range moves the score by at most ~20 points


def test_critical_red_flag_vetoes_a_hot_ipo():
    r = listing_gain_engine(gmp_percent=70.0, subscription_total=80.0, subscription_qib=120.0, company_score=90,
                            red_flags=[_flag("critical", "promoter_fraud_case")])
    assert r["verdict"] == "AVOID" and r["score"] <= 35
    assert r["signals"][0]["direction"] == "negative"
    assert "promoter_fraud_case" in r["signals"][0]["code"]


def test_high_and_medium_flags_reduce_score():
    base = dict(gmp_percent=30.0, subscription_total=15.0, subscription_qib=20.0, company_score=70)
    clean = listing_gain_engine(**base)["score"]
    flagged = listing_gain_engine(**base, red_flags=[_flag("high"), _flag("medium", "y")])["score"]
    assert flagged <= clean - 10


def test_strong_all_round_ipo_is_apply():
    r = listing_gain_engine(gmp_percent=40.0, subscription_total=60.0, subscription_qib=100.0, subscription_retail=30.0,
                            company_score=80, issue_size_cr=300.0, market_regime=70)
    assert r["verdict"] in ("STRONG_APPLY", "MODERATE_APPLY") and r["confidence"] == "high"
    assert r["components"]["gmp"]["weight"] <= 0.20


def test_every_signal_has_a_reason():
    r = listing_gain_engine(gmp_percent=10.0, subscription_total=3.0, company_score=55)
    assert r["signals"] and all(s["reason"] and s["direction"] in ("positive", "negative", "neutral") for s in r["signals"])


def test_backtest_reports_hit_rate_and_baseline():
    outcomes = [
        dict(last_gmp_percent=50.0, last_subscription_total=80.0, listing_gain_percent=45.0),
        dict(last_gmp_percent=40.0, last_subscription_total=60.0, listing_gain_percent=30.0),
        dict(last_gmp_percent=45.0, last_subscription_total=0.9, listing_gain_percent=-12.0),  # hollow GMP
        dict(last_gmp_percent=2.0, last_subscription_total=1.2, listing_gain_percent=-5.0),
        dict(last_gmp_percent=None, last_subscription_total=None, listing_gain_percent=10.0),  # no signals: skipped
    ]
    b = backtest(outcomes)
    assert b["evaluated"] == 4 and b["skipped_no_data"] == 1
    assert b["engine"]["apply_count"] == 2 and b["engine"]["apply_hit_rate"] == 1.0
    assert b["gmp_only"]["apply_count"] == 3 and b["gmp_only"]["apply_hit_rate"] < 1.0
    assert b["engine"]["avg_gain_if_applied"] > b["gmp_only"]["avg_gain_if_applied"]


# ---- thin evidence can neither recommend nor reject (found on real data: loss-making IPOs got 5/100 AVOID from one signal) ----
def test_one_poor_signal_alone_cannot_produce_avoid():
    r = listing_gain_engine(company_score=15, red_flags=[_flag("high", "loss_making")])   # nothing else known
    assert r["confidence"] == "low"
    assert r["score"] == 45 and r["verdict"] == "WATCH"
    assert any(s["code"] == "thin_evidence" for s in r["signals"])
    assert "Watch" in next(s["reason"] for s in r["signals"] if s["code"] == "thin_evidence")


def test_a_verified_critical_flag_still_vetoes_on_thin_evidence():
    r = listing_gain_engine(company_score=80, red_flags=[_flag("critical", "promoter_regulatory_action")])
    assert r["verdict"] == "AVOID" and r["score"] <= 35


def test_enough_evidence_can_still_reject():
    r = listing_gain_engine(company_score=15, subscription_total=0.5, subscription_qib=0.2, gmp_percent=-5.0)
    assert r["confidence"] != "low" and r["verdict"] == "AVOID"
