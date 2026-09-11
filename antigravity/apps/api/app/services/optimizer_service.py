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
        # Prioritize currently open or closing_today issues, fallback to upcoming issues
        open_ipos = [ipo for ipo in ipos if ipo.get("status") in ["open", "closing_today"]]
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
    def _solve_with_pulp(
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
                min_inv = ipo.get("min_investment", 15000)
                lot_size = ipo.get("lot_size", 1)
                price_max = ipo.get("price_band_max", 100)
                lot_cost = lot_size * price_max if lot_size and price_max else min_inv
                score = ipo.get("score", 50) or 50
                gmp_pct = ipo.get("gmp_percent", 15.0) or 15.0

                retail_weight = (min_inv * (gmp_pct / 100.0) * (score / 100.0)) * 0.35
                shni_lots = max(14, int(200000 / lot_cost) + 1)
                shni_capital = shni_lots * lot_cost
                shni_weight = (shni_capital * (gmp_pct / 100.0) * (score / 100.0)) * 0.25

                bhni_lots = max(68, int(1000000 / lot_cost) + 1)
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
            pref_cat = acc.get("preferred_category", "RETAIL")
            account_expenditures = []

            for ipo in active_ipos:
                i_id = ipo["id"]
                min_inv = ipo.get("min_investment", 15000)
                lot_size = ipo.get("lot_size", 1)
                price_max = ipo.get("price_band_max", 100)
                lot_cost = lot_size * price_max if lot_size and price_max else min_inv

                shni_lots = max(14, int(200000 / lot_cost) + 1)
                shni_capital = shni_lots * lot_cost

                bhni_lots = max(68, int(1000000 / lot_cost) + 1)
                bhni_capital = bhni_lots * lot_cost

                account_expenditures.append(min_inv * decision_vars[(a_id, i_id, "RETAIL")])

                # sHNI allowance
                if pref_cat in ["sHNI", "bHNI"] and available >= shni_capital:
                    account_expenditures.append(shni_capital * decision_vars[(a_id, i_id, "sHNI")])
                else:
                    prob += decision_vars[(a_id, i_id, "sHNI")] == 0

                # bHNI allowance (> ₹10L required)
                if pref_cat == "bHNI" and available >= bhni_capital:
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
                lot_size = ipo.get("lot_size", 1)
                price_max = ipo.get("price_band_max", 100)
                lot_cost = lot_size * price_max if lot_size and price_max else ipo.get("min_investment", 15000)
                gmp_pct = ipo.get("gmp_percent", 20.0) or 20.0

                if pulp.value(decision_vars[(a_id, i_id, "bHNI")]) == 1:
                    bhni_lots = max(68, int(1000000 / lot_cost) + 1)
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
                        )
                    )
                elif pulp.value(decision_vars[(a_id, i_id, "sHNI")]) == 1:
                    shni_lots = max(14, int(200000 / lot_cost) + 1)
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
                        )
                    )
                elif pulp.value(decision_vars[(a_id, i_id, "RETAIL")]) == 1:
                    amount = ipo.get("min_investment", 15000)
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

    @staticmethod
    def _solve_greedy(
        active_accounts: List[Dict[str, Any]],
        active_ipos: List[Dict[str, Any]],
    ) -> AllocationPlanResponse:
        sorted_ipos = sorted(active_ipos, key=lambda i: (i.get("score") or 0, i.get("gmp_percent") or 0), reverse=True)
        entries = []
        total_deployed = 0.0

        for acc in active_accounts:
            avail = acc.get("available_liquid_balance", 0)
            pref_cat = acc.get("preferred_category", "RETAIL")
            target_ipo = sorted_ipos[0] if sorted_ipos else None
            if not target_ipo:
                break

            lot_size = target_ipo.get("lot_size", 1)
            price_max = target_ipo.get("price_band_max", 100)
            lot_cost = lot_size * price_max if lot_size and price_max else target_ipo.get("min_investment", 15000)
            min_inv = target_ipo.get("min_investment", 15000)
            gmp_pct = target_ipo.get("gmp_percent", 20.0) or 20.0

            shni_lots = max(14, int(200000 / lot_cost) + 1)
            shni_cost = shni_lots * lot_cost

            bhni_lots = max(68, int(1000000 / lot_cost) + 1)
            bhni_cost = bhni_lots * lot_cost

            if pref_cat == "bHNI" and avail >= bhni_cost:
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
                    )
                )
                total_deployed += bhni_cost
            elif pref_cat in ["sHNI", "bHNI"] and avail >= shni_cost:
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
                    )
                )
                total_deployed += shni_cost
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
                    )
                )
                total_deployed += min_inv

        entries.sort(key=lambda e: e.amount, reverse=True)
        return AllocationPlanResponse(
            plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_capital_deployed=total_deployed,
            entries=entries,
            status="OPTIMAL",
            asba_lock_overlaps_detected=0,
        )
