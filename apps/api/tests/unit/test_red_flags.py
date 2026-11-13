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


def test_fraud_or_regulatory_action_is_critical():
    c = codes(dict(regulatory_action_against_promoter=True))
    assert c["promoter_regulatory_action"] == "critical"
    assert codes(dict(auditor_qualification=True))["auditor_qualification"] == "high"


def test_flags_feed_the_engine_veto():
    flags = detect_red_flags(dict(regulatory_action_against_promoter=True))
    r = listing_gain_engine(gmp_percent=80.0, subscription_total=90.0, subscription_qib=100.0, company_score=85, red_flags=flags)
    assert r["verdict"] == "AVOID"
