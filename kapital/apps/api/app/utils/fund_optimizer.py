import logging
from typing import Dict, Any, List, Optional
import pulp

logger = logging.getLogger("utils.optimizer")


def estimate_allotment_probability(subscription_rate: float, category: str = "RETAIL") -> float:
    """
    Computes mathematical allotment probability based on SEBI allocation rules:
    - RETAIL: Lottery allotment when oversubscribed. P(allotment) = 1 / subscription_rate
    - sHNI: Lottery for minimum sHNI lots when oversubscribed. P(allotment) = 1 / subscription_rate
    - bHNI: Proportional / lottery allotment based on QIB demand and quota size.
    """
    sub = max(0.1, float(subscription_rate or 1.0))
    cat = category.upper()

    if sub <= 1.0:
        return 1.0  # 100% allotment if undersubscribed

    if cat == "RETAIL":
        return min(1.0, 1.0 / sub)
    elif cat == "SHNI":
        # sHNI typically experiences steeper competition; probability scaled by lottery quota
        return min(0.9, 1.0 / sub)
    elif cat == "BHNI":
        # bHNI quota has fewer high-ticket bidders; higher relative allotment odds
        return min(0.95, 1.2 / sub)

    return min(1.0, 1.0 / sub)


def calculate_expected_profit(
    lot_size: int,
    bid_price: float,
    gmp_percent: float,
    probability: float,
    lots: int = 1,
) -> float:
    """
    Computes risk-adjusted expected monetary gain:
    E[Gain] = Probability * (Lots * LotSize * BidPrice * (GMP% / 100))
    """
    total_cost = lots * lot_size * bid_price
    potential_listing_gain = total_cost * (gmp_percent / 100.0)
    return round(probability * potential_listing_gain, 2)


def solve_milp_allocation(
    accounts: List[Dict[str, Any]],
    ipos: List[Dict[str, Any]],
    time_limit_seconds: int = 5,
) -> Optional[Dict[str, Any]]:
    """
    Pure PuLP MILP formulation for multi-account, multi-IPO portfolio optimization.
    Enforces SEBI 1-application-per-PAN constraint.
    """
    if not accounts or not ipos:
        return None

    prob = pulp.LpProblem("IPO_Family_Allocation", pulp.LpMaximize)

    # Categories: RETAIL (approx ₹15K), sHNI (approx ₹2.1L), bHNI (approx ₹10.1L)
    categories = ["RETAIL", "sHNI", "bHNI"]
    x = {}

    for a in accounts:
        a_id = a["id"]
        for ipo in ipos:
            i_id = ipo["id"]
            for cat in categories:
                x[(a_id, i_id, cat)] = pulp.LpVariable(f"x_{a_id}_{i_id}_{cat}", cat="Binary")

    # Objective: Maximize expected listing gain
    obj_terms = []
    for a in accounts:
        a_id = a["id"]
        for ipo in ipos:
            i_id = ipo["id"]
            lot_sz = ipo.get("lot_size", 50)
            price = ipo.get("price_band_max", 100.0)
            gmp_pct = max(0.0, float(ipo.get("gmp_percent") or 0.0))

            # Retail: 1 lot
            p_ret = estimate_allotment_probability(ipo.get("subscription_retail", 1.0), "RETAIL")
            ev_ret = calculate_expected_profit(lot_sz, price, gmp_pct, p_ret, 1)

            # sHNI: minimum lots exceeding ₹2L
            min_shni_lots = max(14, int(200000 / (lot_sz * price)) + 1)
            p_shni = estimate_allotment_probability(ipo.get("subscription_shni", 1.0), "sHNI")
            ev_shni = calculate_expected_profit(lot_sz, price, gmp_pct, p_shni, min_shni_lots)

            # bHNI: minimum lots exceeding ₹10L
            min_bhni_lots = max(68, int(1000000 / (lot_sz * price)) + 1)
            p_bhni = estimate_allotment_probability(ipo.get("subscription_bhni", 1.0), "bHNI")
            ev_bhni = calculate_expected_profit(lot_sz, price, gmp_pct, p_bhni, min_bhni_lots)

            obj_terms.append(x[(a_id, i_id, "RETAIL")] * ev_ret)
            obj_terms.append(x[(a_id, i_id, "sHNI")] * ev_shni)
            obj_terms.append(x[(a_id, i_id, "bHNI")] * ev_bhni)

    prob += pulp.lpSum(obj_terms)

    # Constraint 1: Regulatory 1 bid per account per IPO
    for a in accounts:
        a_id = a["id"]
        for ipo in ipos:
            i_id = ipo["id"]
            prob += (
                pulp.lpSum([x[(a_id, i_id, cat)] for cat in categories]) <= 1,
                f"Regulatory_OneBid_{a_id}_{i_id}",
            )

    # Constraint 2: Liquid balance budget per account
    for a in accounts:
        a_id = a["id"]
        avail = float(a.get("available_liquid_balance") or 0.0)
        cost_terms = []
        for ipo in ipos:
            i_id = ipo["id"]
            lot_sz = ipo.get("lot_size", 50)
            price = ipo.get("price_band_max", 100.0)
            min_shni_lots = max(14, int(200000 / (lot_sz * price)) + 1)
            min_bhni_lots = max(68, int(1000000 / (lot_sz * price)) + 1)

            cost_terms.append(x[(a_id, i_id, "RETAIL")] * (1 * lot_sz * price))
            cost_terms.append(x[(a_id, i_id, "sHNI")] * (min_shni_lots * lot_sz * price))
            cost_terms.append(x[(a_id, i_id, "bHNI")] * (min_bhni_lots * lot_sz * price))

        prob += pulp.lpSum(cost_terms) <= avail, f"Budget_{a_id}"

    # Solve
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit_seconds)
    status = prob.solve(solver)

    if status != pulp.LpStatusOptimal:
        logger.warning(f"PuLP solver finished with status: {pulp.LpStatus[status]}")
        return None

    decisions = {}
    for k, var in x.items():
        if var.varValue and var.varValue > 0.5:
            a_id, i_id, cat = k
            decisions.setdefault(a_id, {})[i_id] = cat

    return {
        "status": "OPTIMAL",
        "objective_value": pulp.value(prob.objective),
        "decisions": decisions,
    }
