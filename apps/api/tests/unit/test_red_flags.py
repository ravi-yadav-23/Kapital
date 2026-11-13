"""M7: deterministic red-flag rules over extracted company facts. Missing facts raise no flag (unknown != bad)."""
from app.utils.red_flags import detect_red_flags
from app.utils.listing_gain import listing_gain_engine


def codes(facts):
    return {f["code"]: f["severity"] for f in detect_red_flags(facts)}


def test_no_facts_no_flags():
    assert detect_red_flags({}) == []


def test_clean_company_has_no_flags():
    facts = dict(net_profit_cr=120, revenue_growth_pct=22, ofs_share_pct=20, promoter_holding_post_pct=65,
                 debt_to_equity=0.6, pe_ratio=22, sector_pe=26, operating_cash_flow_cr=90, material_litigation=False)
    assert detect_red_flags(facts) == []


def test_loss_making_and_negative_cash_flow():
    c = codes(dict(net_profit_cr=-40, operating_cash_flow_cr=-25))
    assert c["loss_making"] == "high" and c["negative_operating_cash_flow"] == "medium"


def test_mostly_offer_for_sale_and_low_promoter_holding():
    c = codes(dict(ofs_share_pct=92, promoter_holding_post_pct=18))
    assert c["mostly_ofs"] == "medium" and c["low_promoter_holding"] == "medium"


def test_rich_valuation_vs_sector():
    assert codes(dict(pe_ratio=70, sector_pe=25))["rich_valuation"] == "high"
    assert "rich_valuation" not in codes(dict(pe_ratio=30, sector_pe=25))


def test_high_leverage_and_litigation():
    c = codes(dict(debt_to_equity=3.5, material_litigation=True))
    assert c["high_leverage"] == "high" and c["material_litigation"] == "medium"


QUOTE = "SEBI passed an order against our Promoter on 12 March 2024 imposing a penalty."


def test_regulatory_action_is_critical_only_with_a_quote_from_the_document():
    facts = dict(regulatory_action_against_promoter=True, regulatory_action_evidence=QUOTE)
    assert codes(facts)["promoter_regulatory_action"] == "critical"
    flag = detect_red_flags(facts)[0]
    assert QUOTE in flag["reason"]                                   # the reader can see why
    # no quote (or a model claim we could not back up) is still shown, but only as a high flag, never a veto
    unverified = codes(dict(regulatory_action_against_promoter=True))
    assert unverified["promoter_regulatory_action"] == "high"
    assert codes(dict(auditor_qualification=True))["auditor_qualification"] == "high"


def test_flags_feed_the_engine_veto():
    flags = detect_red_flags(dict(regulatory_action_against_promoter=True, regulatory_action_evidence=QUOTE))
    r = listing_gain_engine(gmp_percent=80.0, subscription_total=90.0, subscription_qib=100.0, company_score=85, red_flags=flags)
    assert r["verdict"] == "AVOID"
    unverified = detect_red_flags(dict(regulatory_action_against_promoter=True))
    r2 = listing_gain_engine(gmp_percent=80.0, subscription_total=90.0, subscription_qib=100.0, company_score=85, red_flags=unverified)
    assert r2["verdict"] != "AVOID" and r2["score"] > 35               # an unverified claim cannot veto


# ---- lenders (banks, NBFCs, housing-finance companies): debt and operating cash flow mean something else ----
def test_lenders_are_not_flagged_for_leverage_or_negative_operating_cash_flow():
    facts = dict(is_lender=True, debt_to_equity=6.0, operating_cash_flow_cr=-19565.0, net_profit_cr=333.0)
    assert detect_red_flags(facts) == []
    # the rules that still apply to everyone
    assert "loss_making" in codes(dict(is_lender=True, net_profit_cr=-5.0))
    assert "high_leverage" in codes(dict(is_lender=False, debt_to_equity=6.0))


def test_company_score_ignores_debt_and_cash_flow_for_lenders():
    from app.documents.facts import company_score_from_facts
    base = dict(net_profit_cr=300.0, revenue_growth_pct=30.0, promoter_holding_post_pct=60.0)
    plain_bad = company_score_from_facts({**base, "debt_to_equity": 6.0, "operating_cash_flow_cr": -9000.0})
    lender = company_score_from_facts({**base, "debt_to_equity": 6.0, "operating_cash_flow_cr": -9000.0, "is_lender": True})
    assert lender > plain_bad + 10 and lender >= 75


def test_lender_detection_uses_the_model_flag_or_the_company_name():
    from app.documents.facts import looks_like_lender, clean_facts
    assert clean_facts({"is_lender": True}) == {"is_lender": True}
    for name in ("Truhome Finance Limited", "Arohan Financial Services", "XYZ Small Finance Bank", "ABC Housing Finserv", "Kotak Capital"):
        assert looks_like_lender(name), name
    for name in ("Zepto Limited", "OYO Hotels", "Bajaj Energy"):
        assert not looks_like_lender(name), name
