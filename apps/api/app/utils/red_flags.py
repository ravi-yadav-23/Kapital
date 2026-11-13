"""Deterministic red-flag rules over extracted company facts (pure functions).

A fact that is missing / None never raises a flag: unknown is reported as unknown elsewhere, not as bad.
Each flag is {code, severity: critical|high|medium, reason}; listing_gain_engine consumes them.
"""
from typing import Any, Dict, List


def _num(facts: Dict[str, Any], key: str):
    v = facts.get(key)
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _flag(code: str, severity: str, reason: str) -> Dict[str, str]:
    return {"code": code, "severity": severity, "reason": reason}


def detect_red_flags(facts: Dict[str, Any]) -> List[Dict[str, str]]:
    flags: List[Dict[str, str]] = []
    if facts.get("regulatory_action_against_promoter") is True:
        quote = (facts.get("regulatory_action_evidence") or "").strip()
        if quote:   # only a quote taken from the document can veto an IPO
            flags.append(_flag("promoter_regulatory_action", "critical",
                               f"Regulatory / enforcement action against a promoter or the company. Document says: \u201c{quote}\u201d"))
        else:
            flags.append(_flag("promoter_regulatory_action", "high",
                               "A regulatory / enforcement action against a promoter or the company was reported but could not "
                               "be backed with a quote from the document (unverified)."))
    if facts.get("auditor_qualification") is True:
        quote = (facts.get("auditor_qualification_evidence") or "").strip()
        flags.append(_flag("auditor_qualification", "high",
                           "Auditor has qualified or flagged the financial statements."
                           + (f" Document says: \u201c{quote}\u201d" if quote else " (unverified)")))

    profit = _num(facts, "net_profit_cr")
    if profit is not None and profit < 0:
        flags.append(_flag("loss_making", "high", f"Company is loss-making (net profit Rs {profit:.0f} cr)."))
    lender = facts.get("is_lender") is True  # for a lender, loan disbursements make operating cash flow negative and debt is its raw material
    ocf = _num(facts, "operating_cash_flow_cr")
    if ocf is not None and ocf < 0 and not lender:
        flags.append(_flag("negative_operating_cash_flow", "medium", f"Operating cash flow is negative (Rs {ocf:.0f} cr)."))

    ofs = _num(facts, "ofs_share_pct")
    if ofs is not None and ofs >= 80:
        flags.append(_flag("mostly_ofs", "medium", f"{ofs:.0f}% of the issue is an offer for sale: little money reaches the company."))
    promoter = _num(facts, "promoter_holding_post_pct")
    if promoter is not None and promoter < 25:
        flags.append(_flag("low_promoter_holding", "medium", f"Promoter holding after the issue is only {promoter:.0f}%."))

    pe, sector = _num(facts, "pe_ratio"), _num(facts, "sector_pe")
    if pe is not None and sector and sector > 0 and pe > 2 * sector:
        flags.append(_flag("rich_valuation", "high", f"P/E of {pe:.0f} is more than double the sector P/E of {sector:.0f}."))
    de = _num(facts, "debt_to_equity")
    if de is not None and de > 2.5 and not lender:
        flags.append(_flag("high_leverage", "high", f"Debt-to-equity of {de:.1f} is high."))
    if facts.get("material_litigation") is True:
        flags.append(_flag("material_litigation", "medium", "Material litigation is disclosed in the offer document."))
    return flags
