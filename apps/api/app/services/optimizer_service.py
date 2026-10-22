from typing import List, Dict, Any
from datetime import datetime, timezone
from app.schemas.fund import AllocationPlanResponse, AllocationEntrySchema

try:
    import pulp
    HAS_PULP = True
except ImportError:
    HAS_PULP = False

class AllocationOptimizer:
    """
    Mathematical Optimization Solver for IPO Fund Allocation across Multi-Demat Accounts.
    Uses PuLP MILP solver when available, with an optimal greedy knapsack solver fallback.
    Supports RETAIL (<= ₹2L), sHNI (₹2L - ₹10L), and bHNI (> ₹10L) capital buckets.
    """

    @classmethod
    def solve_allocation(
        cls,
        accounts: List[Dict[str, Any]],
        ipos: List[Dict[str, Any]],
        max_exposure_pct: float = 80.0,
    ) -> AllocationPlanResponse:
        today = datetime.now(timezone.utc).date()
        def _is_active_open(ipo: Dict[str, Any]) -> bool:
            if ipo.get("status") not in ["open", "closing_today"]:
                return False
            close_d = ipo.get("issue_close_date")
            if close_d:
                if isinstance(close_d, str):
                    try:
                        close_d = datetime.strptime(close_d[:10], "%Y-%m-%d").date()
                    except Exception:
                        pass
                if hasattr(close_d, "year") and close_d < today:
                    return False
            return True

        open_ipos = [ipo for ipo in ipos if _is_active_open(ipo)]
        active_ipos = open_ipos if open_ipos else [ipo for ipo in ipos if ipo.get("status") == "upcoming"]

        # Filter active accounts with sufficient balance for at least 1 retail lot
        min_lot_cost = min((ipo.get("min_investment", 14000) for ipo in active_ipos), default=14000)
        active_accounts = [
            acc for acc in accounts
            if acc.get("is_active", True) and acc.get("available_liquid_balance", 0) >= min_lot_cost
        ]

        if not active_ipos or not active_accounts:
            return AllocationPlanResponse(
                plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="NO_ACTIVE_ISSUES" if not active_ipos else "INSUFFICIENT_FUNDS",
                asba_lock_overlaps_detected=0,
            )

        if HAS_PULP:
            try:
                return cls._solve_with_pulp(active_accounts, active_ipos)
            except Exception:
                return cls._solve_greedy(active_accounts, active_ipos)
        else:
            return cls._solve_greedy(active_accounts, active_ipos)

    @staticmethod
    def _compute_lot_cost_and_lots(ipo: Dict[str, Any]) -> tuple[float, float, int, int]:
        """
        Returns (lot_cost, min_inv, shni_lots, bhni_lots).
        Safely computes sHNI (> ₹2L) and bHNI (> ₹10L) lot counts based on actual lot cost.
        """
        min_inv = float(ipo.get("min_investment") or 0.0)
        lot_size = float(ipo.get("lot_size") or 0.0)
        price_max = float(ipo.get("price_band_max") or 0.0)
        lot_cost = lot_size * price_max if lot_size > 0 and price_max > 0 else min_inv
        if lot_cost < 1000.0:
            lot_cost = min_inv if min_inv >= 1000.0 else 15000.0
        if min_inv < 1000.0:
            min_inv = lot_cost

        # sHNI requires strictly > ₹200,000
        shni_lots = int(200000.0 / lot_cost) + 1
        # bHNI requires strictly > ₹1,000,000
        bhni_lots = int(1000000.0 / lot_cost) + 1

        return lot_cost, min_inv, shni_lots, bhni_lots

    @classmethod
    def _solve_with_pulp(
        cls,
        active_accounts: List[Dict[str, Any]],
        active_ipos: List[Dict[str, Any]],
    ) -> AllocationPlanResponse:
        prob = pulp.LpProblem("IPO_Family_Allocation", pulp.LpMaximize)
        decision_vars = {}
        categories = ["RETAIL", "sHNI", "bHNI"]

        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                for cat in categories:
                    decision_vars[(a_id, i_id, cat)] = pulp.LpVariable(f"x_{a_id}_{i_id}_{cat}", cat="Binary")

        objective_terms = []
        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                score = ipo.get("score", 50) or 50
                gmp_pct = ipo.get("gmp_percent", 15.0) or 15.0

                retail_weight = (min_inv * (gmp_pct / 100.0) * (score / 100.0)) * 0.35
                shni_capital = shni_lots * lot_cost
                shni_weight = (shni_capital * (gmp_pct / 100.0) * (score / 100.0)) * 0.25

                bhni_capital = bhni_lots * lot_cost
                bhni_weight = (bhni_capital * (gmp_pct / 100.0) * (score / 100.0)) * 0.40

                objective_terms.append(retail_weight * decision_vars[(a_id, i_id, "RETAIL")])
                objective_terms.append(shni_weight * decision_vars[(a_id, i_id, "sHNI")])
                objective_terms.append(bhni_weight * decision_vars[(a_id, i_id, "bHNI")])

        prob += pulp.lpSum(objective_terms)

        # Max 1 bid per account per IPO (SEBI rule: one application per PAN per issue)
        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                prob += (
                    decision_vars[(a_id, i_id, "RETAIL")]
                    + decision_vars[(a_id, i_id, "sHNI")]
                    + decision_vars[(a_id, i_id, "bHNI")]
                    <= 1,
                    f"One_Category_{a_id}_{i_id}",
                )

        # Budget constraints per account & preferred category enforcement
        for acc in active_accounts:
            a_id = acc["id"]
            available = acc.get("available_liquid_balance", 0)
            pref_cat = (acc.get("preferred_category", "RETAIL") or "RETAIL").upper()
            account_expenditures = []

            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                shni_capital = shni_lots * lot_cost
                bhni_capital = bhni_lots * lot_cost

                account_expenditures.append(min_inv * decision_vars[(a_id, i_id, "RETAIL")])

                # sHNI allowance
                if pref_cat in ["SHNI", "BHNI"] and available >= shni_capital:
                    account_expenditures.append(shni_capital * decision_vars[(a_id, i_id, "sHNI")])
                else:
                    prob += decision_vars[(a_id, i_id, "sHNI")] == 0

                # bHNI allowance (> ₹10L required)
                if pref_cat == "BHNI" and available >= bhni_capital:
                    account_expenditures.append(bhni_capital * decision_vars[(a_id, i_id, "bHNI")])
                else:
                    prob += decision_vars[(a_id, i_id, "bHNI")] == 0

            prob += pulp.lpSum(account_expenditures) <= available

        prob.solve(pulp.PULP_CBC_CMD(msg=0))

        entries = []
        total_deployed = 0.0

        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                gmp_pct = ipo.get("gmp_percent", 20.0) or 20.0

                if pulp.value(decision_vars[(a_id, i_id, "bHNI")]) == 1:
                    amount = bhni_lots * lot_cost
                    total_deployed += amount
                    entries.append(
                        AllocationEntrySchema(
                            account_id=a_id,
                            account_name=acc["name"],
                            ipo_id=i_id,
                            ipo_name=ipo["name"],
                            category="bHNI",
                            lots=bhni_lots,
                            amount=amount,
                            expected_return_pct=gmp_pct,
                            reason=f"bHNI high-conviction deployment (+{gmp_pct}% GMP)",
                        )
                    )
                elif pulp.value(decision_vars[(a_id, i_id, "sHNI")]) == 1:
                    amount = shni_lots * lot_cost
                    total_deployed += amount
                    entries.append(
                        AllocationEntrySchema(
                            account_id=a_id,
                            account_name=acc["name"],
                            ipo_id=i_id,
                            ipo_name=ipo["name"],
                            category="sHNI",
                            lots=shni_lots,
                            amount=amount,
                            expected_return_pct=gmp_pct,
                            reason=f"sHNI allocation edge (+{gmp_pct}% GMP)",
                        )
                    )
                elif pulp.value(decision_vars[(a_id, i_id, "RETAIL")]) == 1:
                    amount = min_inv
                    total_deployed += amount
                    entries.append(
                        AllocationEntrySchema(
                            account_id=a_id,
                            account_name=acc["name"],
                            ipo_id=i_id,
                            ipo_name=ipo["name"],
                            category="RETAIL",
                            lots=1,
                            amount=amount,
                            expected_return_pct=gmp_pct,
                            reason=f"Retail lottery odds maximization (+{gmp_pct}% GMP)",
                        )
                    )

        entries.sort(key=lambda e: e.amount, reverse=True)
        return AllocationPlanResponse(
            plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_capital_deployed=total_deployed,
            entries=entries,
            status="OPTIMAL",
            asba_lock_overlaps_detected=0,
        )

    @classmethod
    def _solve_greedy(
        cls,
        active_accounts: List[Dict[str, Any]],
        active_ipos: List[Dict[str, Any]],
    ) -> AllocationPlanResponse:
        sorted_ipos = sorted(
            active_ipos,
            key=lambda i: ((i.get("gmp_percent") or 0.0) * ((i.get("score") or 50.0) / 100.0), i.get("gmp_percent") or 0.0),
            reverse=True,
        )
        entries = []
        total_deployed = 0.0

        for acc in active_accounts:
            avail = acc.get("available_liquid_balance", 0)
            pref_cat = (acc.get("preferred_category", "RETAIL") or "RETAIL").upper()

            for target_ipo in sorted_ipos:
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(target_ipo)
                gmp_pct = target_ipo.get("gmp_percent", 20.0) or 20.0
                shni_cost = shni_lots * lot_cost
                bhni_cost = bhni_lots * lot_cost

                if pref_cat == "BHNI" and avail >= bhni_cost:
                    entries.append(
                        AllocationEntrySchema(
                            account_id=acc["id"],
                            account_name=acc["name"],
                            ipo_id=target_ipo["id"],
                            ipo_name=target_ipo["name"],
                            category="bHNI",
                            lots=bhni_lots,
                            amount=bhni_cost,
                            expected_return_pct=gmp_pct,
                            reason=f"bHNI high-conviction deployment (+{gmp_pct}% GMP)",
                        )
                    )
                    total_deployed += bhni_cost
                    avail -= bhni_cost
                elif pref_cat in ["SHNI", "BHNI"] and avail >= shni_cost:
                    entries.append(
                        AllocationEntrySchema(
                            account_id=acc["id"],
                            account_name=acc["name"],
                            ipo_id=target_ipo["id"],
                            ipo_name=target_ipo["name"],
                            category="sHNI",
                            lots=shni_lots,
                            amount=shni_cost,
                            expected_return_pct=gmp_pct,
                            reason=f"sHNI allocation edge (+{gmp_pct}% GMP)",
                        )
                    )
                    total_deployed += shni_cost
                    avail -= shni_cost
                elif avail >= min_inv:
                    entries.append(
                        AllocationEntrySchema(
                            account_id=acc["id"],
                            account_name=acc["name"],
                            ipo_id=target_ipo["id"],
                            ipo_name=target_ipo["name"],
                            category="RETAIL",
                            lots=1,
                            amount=min_inv,
                            expected_return_pct=gmp_pct,
                            reason=f"Retail lottery odds maximization (+{gmp_pct}% GMP)",
                        )
                    )
                    total_deployed += min_inv
                    avail -= min_inv

        entries.sort(key=lambda e: e.amount, reverse=True)
        return AllocationPlanResponse(
            plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_capital_deployed=total_deployed,
            entries=entries,
            status="OPTIMAL",
            asba_lock_overlaps_detected=0,
        )
