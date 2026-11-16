"""The worked examples in the web docs (/docs/score-walkthrough and the score-walkthrough diagram) quote exact
numbers. Re-compute them with the real engine so the documentation cannot drift from the code."""
from app.utils.allotment_odds import allotment_probability, expected_value_per_rupee
from app.utils.listing_gain import listing_gain_engine
from app.utils.scoring import gmp_strength, subscription_momentum


def test_example_1_well_supported_ipo():
    assert subscription_momentum(40) == 90 and subscription_momentum(80) == 100 and gmp_strength(30) == 66
    r = listing_gain_engine(gmp_percent=30, subscription_total=40, subscription_qib=80, issue_size_cr=600,
                            company_score=68, red_flags=[{"code": "mostly_ofs", "severity": "medium", "reason": "OFS"}])
    c = r["components"]
    assert c["demand"]["value"] == 95 and c["gmp"]["value"] == 66 and c["float"]["value"] == 60 and "market" not in c
    weighted = (68 * 0.30 + 95 * 0.30 + 66 * 0.20 + 60 * 0.10) / 0.90
    assert round(weighted, 1) == 75.7 and round(weighted - 4, 1) == 71.7
    assert (r["score"], r["verdict"], r["confidence"]) == (72, "MODERATE_APPLY", "high")


def test_example_2_grey_market_not_backed_by_demand():
    assert gmp_strength(60) == 84 and subscription_momentum(2) == 45 and subscription_momentum(1.5) == 42
    r = listing_gain_engine(gmp_percent=60, subscription_total=2, subscription_qib=1.5)
    assert r["components"]["demand"]["value"] == 44 and r["components"]["gmp"]["value"] == 59
    assert any(s["code"] == "gmp_unbacked" for s in r["signals"])
    assert (r["score"], r["verdict"], r["confidence"]) == (50, "WATCH", "medium")


def test_allotment_value_example():
    hot = {"gmp_percent": 60, "subscription_retail": 50}
    quiet = {"gmp_percent": 15, "subscription_retail": 1.5}
    assert allotment_probability("RETAIL", hot)[0] == 0.02
    assert round(expected_value_per_rupee("RETAIL", hot) * 100, 1) == 1.2
    assert round(expected_value_per_rupee("RETAIL", quiet) * 100, 1) == 10.0


def test_score_breakdown_points_and_steps_match_the_score():
    cases = [
        dict(gmp_percent=30, subscription_total=40, subscription_qib=80, issue_size_cr=600, company_score=68,
             red_flags=[{"code": "mostly_ofs", "severity": "medium", "reason": "OFS"}]),
        dict(gmp_percent=60, subscription_total=2, subscription_qib=1.5),
        dict(company_score=91),                                   # thin evidence: held at 60
        dict(subscription_total=0.5),                             # thin evidence: held at 45
        dict(gmp_percent=9.9, company_score=80, red_flags=[{"code": "c", "severity": "critical", "reason": "x"}]),
    ]
    for kw in cases:
        r = listing_gain_engine(**kw)
        steps = r["steps"]
        assert steps[0]["code"] == "weighted_average" and steps[-1]["code"] == "final"
        assert steps[-1]["score"] == r["score"]
        points = sum(c["points"] for c in r["components"].values())
        assert abs(points - steps[0]["score"]) <= 0.3, kw          # per-line rounding only
    ex1 = listing_gain_engine(**cases[0])["steps"]
    assert [s["score"] for s in ex1] == [75.7, 71.7, 72.0]
    assert [s["code"] for s in listing_gain_engine(**cases[2])["steps"]] == ["weighted_average", "thin_evidence_ceiling", "final"]
    assert [s["code"] for s in listing_gain_engine(**cases[3])["steps"]] == ["weighted_average", "thin_evidence_floor", "final"]
    assert listing_gain_engine(**cases[4])["steps"][-2]["code"] == "critical_cap"
