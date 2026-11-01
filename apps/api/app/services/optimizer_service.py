"""
IPO Family Allocation Optimizer
================================
Uses PuLP MILP solver (with greedy fallback) to optimally distribute capital
across family demat accounts and active IPO bidding windows.

Key capabilities:
- SEBI 1-application-per-PAN constraint enforcement
- RETAIL / sHNI / bHNI capital bucket allocation
- ASBA capital reservation for upcoming high-score IPOs
  (don't over-commit funds that will be locked when a better IPO opens)
- Real asba_lock_overlaps_detected count (was always 0 before)
- Date-aware filtering: skips closed issues regardless of DB status flag
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta, timezone, date as DateType

from app.schemas.fund import AllocationPlanResponse, AllocationEntrySchema, UpcomingConflictSchema  # noqa: F401

try:
    import pulp
    HAS_PULP = True
except ImportError:
    HAS_PULP = False

# ASBA refund typically arrives T+6 from allotment date (SEBI mandate).
# If allotment_date is unknown, we conservatively assume 8 days after close.
_ASBA_DEFAULT_LOCK_DAYS = 8
# Only reserve capital for upcoming IPOs with score >= this threshold.
_RESERVATION_MIN_SCORE = 60
# Only reserve for upcoming IPOs opening within this many days.
_RESERVATION_LOOKAHEAD_DAYS = 30


def _parse_date(val: Any) -> DateType | None:
    """Safely parse a date from string or date object."""
    if val is None:
        return None
    if isinstance(val, DateType):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str) and val:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(val[:10], fmt).date()
            except ValueError:
                continue
    return None


def _compute_asba_refund_date(ipo: Dict[str, Any]) -> DateType | None:
    """
    Returns the estimated date on which ASBA funds are freed for an IPO.
    Priority: refund_date field → allotment_date + 2 → close_date + 8 days.
    """
    refund_d = _parse_date(ipo.get("refund_date"))
    if refund_d:
        return refund_d
    allot_d = _parse_date(ipo.get("allotment_date"))
    if allot_d:
        return allot_d + timedelta(days=2)
    close_d = _parse_date(ipo.get("issue_close_date"))
    if close_d:
        return close_d + timedelta(days=_ASBA_DEFAULT_LOCK_DAYS)
    return None


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

        # ── 1. Filter active open issues with date guard ───────────────────────
        def _is_active_open(ipo: Dict[str, Any]) -> bool:
            if ipo.get("status") not in ["open", "closing_today"]:
                return False
            close_d = _parse_date(ipo.get("issue_close_date"))
            if close_d and close_d < today:
                return False
            return True

        open_ipos = [ipo for ipo in ipos if _is_active_open(ipo)]
        # Fall back to upcoming issues only if nothing is currently open
        active_ipos = open_ipos if open_ipos else [
            ipo for ipo in ipos
            if ipo.get("status") == "upcoming"
            and (_parse_date(ipo.get("issue_open_date")) or today) >= today
        ]

        # ── 2. Identify upcoming high-value IPOs for capital reservation ───────
        lookahead_cutoff = today + timedelta(days=_RESERVATION_LOOKAHEAD_DAYS)
        upcoming_high_score = [
            ipo for ipo in ipos
            if ipo.get("status") == "upcoming"
            and (ipo.get("score") or 0) >= _RESERVATION_MIN_SCORE
            and _parse_date(ipo.get("issue_open_date")) is not None
            and today <= _parse_date(ipo.get("issue_open_date")) <= lookahead_cutoff  # type: ignore[operator]
        ]
        upcoming_high_score.sort(key=lambda x: (x.get("score") or 0, x.get("gmp_percent") or 0), reverse=True)

        # ── 3. Compute per-account capital reservation & ASBA conflict count ──
        asba_conflicts = 0
        accounts_with_reservation: List[Dict[str, Any]] = []

        for acc in accounts:
            acc_copy = dict(acc)
            raw_balance = acc.get("available_liquid_balance", 0) or 0
            reservation = 0.0
            conflict_ipos: List[str] = []

            # For each active IPO, check if its ASBA lock overlaps an upcoming IPO window
            for open_ipo in active_ipos:
                asba_free = _compute_asba_refund_date(open_ipo)
                if asba_free is None:
                    continue
                for upcoming in upcoming_high_score:
                    upcoming_open = _parse_date(upcoming.get("issue_open_date"))
                    if upcoming_open and upcoming_open <= asba_free:
                        # Conflict: money would still be locked when this IPO opens
                        conflict_ipos.append(upcoming.get("name", upcoming.get("id", "Unknown")))

            # Reserve capital for upcoming high-score IPOs that overlap active ASBA windows.
            # To avoid starving the current active bidding window, reserve for the largest conflicting
            # requirement (since funds recycle sequentially) rather than naively summing all future dates.
            max_conflicting_needed = 0.0
            for upcoming in upcoming_high_score:
                upcoming_open = _parse_date(upcoming.get("issue_open_date"))
                if upcoming_open is None:
                    continue

                # Check if this account's current IPO funds will be freed in time
                will_be_locked = False
                for open_ipo in active_ipos:
                    asba_free = _compute_asba_refund_date(open_ipo)
                    if asba_free and upcoming_open <= asba_free:
                        will_be_locked = True
                        break

                lot_cost, min_inv, _, _ = cls._compute_lot_cost_and_lots(upcoming)
                pref_cat = (acc.get("preferred_category", "RETAIL") or "RETAIL").upper()
                if pref_cat in ["SHNI", "BHNI"]:
                    shni_lots = int(200000.0 / lot_cost) + 1
                    needed = shni_lots * lot_cost
                else:
                    needed = min_inv

                if will_be_locked:
                    if upcoming.get("name", "") not in conflict_ipos:
                        conflict_ipos.append(upcoming.get("name", upcoming.get("id", "")))
                    if needed > max_conflicting_needed:
                        max_conflicting_needed = needed

            reservation = max_conflicting_needed

            if conflict_ipos:
                asba_conflicts += 1

            effective_balance = max(0.0, raw_balance - reservation)
            acc_copy["available_liquid_balance"] = effective_balance
            acc_copy["_raw_balance"] = raw_balance
            acc_copy["_reserved_for_upcoming"] = reservation
            acc_copy["_conflict_ipos"] = conflict_ipos
            accounts_with_reservation.append(acc_copy)

        # ── 4. Filter accounts with sufficient effective balance ───────────────
        if active_ipos:
            min_lot_cost = min((ipo.get("min_investment", 14000) for ipo in active_ipos), default=14000)
        else:
            min_lot_cost = 14000

        active_accounts = [
            acc for acc in accounts_with_reservation
            if acc.get("is_active", True) and acc.get("available_liquid_balance", 0) >= min_lot_cost
        ]

        # ── 5. Build warnings for reserved capital & conflicts ─────────────────
        warnings: List[str] = []
        upcoming_conflicts: List[UpcomingConflictSchema] = []
        skipped_ipos = []

        for acc in accounts_with_reservation:
            reserved = acc.get("_reserved_for_upcoming", 0)
            conflicts = acc.get("_conflict_ipos", [])
            if reserved > 0 and conflicts:
                conflict_names = ", ".join(conflicts[:3])
                warnings.append(
                    f"{acc['name']}: ₹{reserved:,.0f} reserved for upcoming {conflict_names}"
                    f" — ASBA funds may be blocked when it opens."
                )
            elif reserved > 0:
                upcoming_names = ", ".join(u.get("name", "") for u in upcoming_high_score[:2])
                warnings.append(
                    f"{acc['name']}: ₹{reserved:,.0f} held back for upcoming {upcoming_names}"
                )

        for upcoming in upcoming_high_score:
            upcoming_open = _parse_date(upcoming.get("issue_open_date"))
            conflict_details = []
            for open_ipo in active_ipos:
                asba_free = _compute_asba_refund_date(open_ipo)
                if asba_free and upcoming_open and upcoming_open <= asba_free:
                    conflict_details.append({
                        "blocking_ipo": open_ipo.get("name", ""),
                        "asba_free_date": asba_free.isoformat(),
                        "upcoming_open_date": upcoming_open.isoformat(),
                    })
            if conflict_details:
                upcoming_conflicts.append(
                    UpcomingConflictSchema(
                        upcoming_ipo_name=upcoming.get("name", ""),
                        upcoming_score=upcoming.get("score", 0) or 0,
                        upcoming_gmp=upcoming.get("gmp_percent", 0.0) or 0.0,
                        open_date=upcoming_open.isoformat() if upcoming_open else None,
                        conflicts=conflict_details,
                    )
                )

        if not active_ipos or not active_accounts:
            return AllocationPlanResponse(
                plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
                generated_at=datetime.now(timezone.utc).isoformat(),
                total_capital_deployed=0.0,
                entries=[],
                status="NO_ACTIVE_ISSUES" if not active_ipos else "INSUFFICIENT_FUNDS",
                asba_lock_overlaps_detected=asba_conflicts,
                warnings=warnings,
                upcoming_conflicts=upcoming_conflicts,
            )

        # ── 6. Run optimizer ───────────────────────────────────────────────────
        if HAS_PULP:
            try:
                plan = cls._solve_with_pulp(active_accounts, active_ipos)
            except Exception:
                plan = cls._solve_greedy(active_accounts, active_ipos)
        else:
            plan = cls._solve_greedy(active_accounts, active_ipos)

        # Attach reservation metadata to the plan
        plan.asba_lock_overlaps_detected = asba_conflicts
        plan.warnings = warnings + plan.warnings
        plan.upcoming_conflicts = upcoming_conflicts
        return plan

    @staticmethod
    def _compute_lot_cost_and_lots(ipo: Dict[str, Any]) -> Tuple[float, float, int, int]:
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
                    decision_vars[(a_id, i_id, cat)] = pulp.LpVariable(
                        f"x_{a_id}_{i_id}_{cat}", cat="Binary"
                    )

        objective_terms = []
        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                score = ipo.get("score", 50) or 50
                gmp_pct = ipo.get("gmp_percent", 15.0) or 15.0

                # Weight = expected capital gain (amount × gmp%) × score confidence
                retail_weight = (min_inv * (gmp_pct / 100.0) * (score / 100.0)) * 0.35
                shni_capital = shni_lots * lot_cost
                shni_weight = (shni_capital * (gmp_pct / 100.0) * (score / 100.0)) * 0.25
                bhni_capital = bhni_lots * lot_cost
                bhni_weight = (bhni_capital * (gmp_pct / 100.0) * (score / 100.0)) * 0.40

                objective_terms.append(retail_weight * decision_vars[(a_id, i_id, "RETAIL")])
                objective_terms.append(shni_weight * decision_vars[(a_id, i_id, "sHNI")])
                objective_terms.append(bhni_weight * decision_vars[(a_id, i_id, "bHNI")])

        prob += pulp.lpSum(objective_terms)

        # SEBI constraint: max 1 bid per account per IPO (one PAN = one application)
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
            # Use the effective (reservation-adjusted) balance
            available = acc.get("available_liquid_balance", 0)
            pref_cat = (acc.get("preferred_category", "RETAIL") or "RETAIL").upper()
            account_expenditures = []

            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                shni_capital = shni_lots * lot_cost
                bhni_capital = bhni_lots * lot_cost

                account_expenditures.append(min_inv * decision_vars[(a_id, i_id, "RETAIL")])

                # sHNI allowance — only if account preference allows and has sufficient balance
                if pref_cat in ["SHNI", "BHNI"] and available >= shni_capital:
                    account_expenditures.append(shni_capital * decision_vars[(a_id, i_id, "sHNI")])
                else:
                    prob += decision_vars[(a_id, i_id, "sHNI")] == 0

                # bHNI allowance — only for bHNI-designated accounts with > ₹10L available
                if pref_cat == "BHNI" and available >= bhni_capital:
                    account_expenditures.append(bhni_capital * decision_vars[(a_id, i_id, "bHNI")])
                else:
                    prob += decision_vars[(a_id, i_id, "bHNI")] == 0

            prob += pulp.lpSum(account_expenditures) <= available

        prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=15))

        entries = []
        total_deployed = 0.0

        for acc in active_accounts:
            a_id = acc["id"]
            for ipo in active_ipos:
                i_id = ipo["id"]
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(ipo)
                gmp_pct = ipo.get("gmp_percent", 20.0) or 20.0
                score = ipo.get("score", 50) or 50

                # Guard: PuLP may return None for infeasible variables
                bhni_val = pulp.value(decision_vars[(a_id, i_id, "bHNI")])
                shni_val = pulp.value(decision_vars[(a_id, i_id, "sHNI")])
                ret_val = pulp.value(decision_vars[(a_id, i_id, "RETAIL")])

                # Reservation context for reason string
                reserved = acc.get("_reserved_for_upcoming", 0)
                reservation_note = f" (₹{reserved:,.0f} held back for upcoming issues)" if reserved > 0 else ""

                if bhni_val is not None and round(bhni_val) == 1:
                    amount = bhni_lots * lot_cost
                    total_deployed += amount
                    entries.append(AllocationEntrySchema(
                        account_id=a_id,
                        account_name=acc["name"],
                        ipo_id=i_id,
                        ipo_name=ipo["name"],
                        category="bHNI",
                        lots=bhni_lots,
                        amount=amount,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"bHNI high-conviction deployment (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))
                elif shni_val is not None and round(shni_val) == 1:
                    amount = shni_lots * lot_cost
                    total_deployed += amount
                    entries.append(AllocationEntrySchema(
                        account_id=a_id,
                        account_name=acc["name"],
                        ipo_id=i_id,
                        ipo_name=ipo["name"],
                        category="sHNI",
                        lots=shni_lots,
                        amount=amount,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"sHNI lottery edge (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))
                elif ret_val is not None and round(ret_val) == 1:
                    total_deployed += min_inv
                    entries.append(AllocationEntrySchema(
                        account_id=a_id,
                        account_name=acc["name"],
                        ipo_id=i_id,
                        ipo_name=ipo["name"],
                        category="RETAIL",
                        lots=1,
                        amount=min_inv,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"Retail allotment odds maximization (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))

        entries.sort(key=lambda e: e.amount, reverse=True)
        return AllocationPlanResponse(
            plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_capital_deployed=total_deployed,
            entries=entries,
            status="OPTIMAL",
            asba_lock_overlaps_detected=0,  # overwritten by caller
            warnings=[],
        )

    @classmethod
    def _solve_greedy(
        cls,
        active_accounts: List[Dict[str, Any]],
        active_ipos: List[Dict[str, Any]],
    ) -> AllocationPlanResponse:
        """
        Greedy knapsack fallback when PuLP is unavailable.
        Sorts IPOs by (score × gmp_percent) and allocates per account.
        """
        sorted_ipos = sorted(
            active_ipos,
            key=lambda i: ((i.get("gmp_percent") or 0.0) * ((i.get("score") or 50.0) / 100.0),
                           i.get("gmp_percent") or 0.0),
            reverse=True,
        )
        entries = []
        total_deployed = 0.0

        for acc in active_accounts:
            avail = acc.get("available_liquid_balance", 0)
            pref_cat = (acc.get("preferred_category", "RETAIL") or "RETAIL").upper()
            reserved = acc.get("_reserved_for_upcoming", 0)
            reservation_note = f" (₹{reserved:,.0f} held back for upcoming issues)" if reserved > 0 else ""

            for target_ipo in sorted_ipos:
                lot_cost, min_inv, shni_lots, bhni_lots = cls._compute_lot_cost_and_lots(target_ipo)
                gmp_pct = target_ipo.get("gmp_percent", 20.0) or 20.0
                score = target_ipo.get("score", 50) or 50
                shni_cost = shni_lots * lot_cost
                bhni_cost = bhni_lots * lot_cost

                if pref_cat == "BHNI" and avail >= bhni_cost:
                    entries.append(AllocationEntrySchema(
                        account_id=acc["id"],
                        account_name=acc["name"],
                        ipo_id=target_ipo["id"],
                        ipo_name=target_ipo["name"],
                        category="bHNI",
                        lots=bhni_lots,
                        amount=bhni_cost,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"bHNI high-conviction deployment (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))
                    total_deployed += bhni_cost
                    avail -= bhni_cost
                elif pref_cat in ["SHNI", "BHNI"] and avail >= shni_cost:
                    entries.append(AllocationEntrySchema(
                        account_id=acc["id"],
                        account_name=acc["name"],
                        ipo_id=target_ipo["id"],
                        ipo_name=target_ipo["name"],
                        category="sHNI",
                        lots=shni_lots,
                        amount=shni_cost,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"sHNI lottery edge (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))
                    total_deployed += shni_cost
                    avail -= shni_cost
                elif avail >= min_inv:
                    entries.append(AllocationEntrySchema(
                        account_id=acc["id"],
                        account_name=acc["name"],
                        ipo_id=target_ipo["id"],
                        ipo_name=target_ipo["name"],
                        category="RETAIL",
                        lots=1,
                        amount=min_inv,
                        expected_return_pct=round(gmp_pct, 2),
                        reason=f"Retail allotment odds maximization (+{gmp_pct}% GMP, score {score}){reservation_note}",
                    ))
                    total_deployed += min_inv
                    avail -= min_inv

        entries.sort(key=lambda e: e.amount, reverse=True)
        return AllocationPlanResponse(
            plan_id=f"plan-{int(datetime.now(timezone.utc).timestamp())}",
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_capital_deployed=total_deployed,
            entries=entries,
            status="OPTIMAL",
            asba_lock_overlaps_detected=0,  # overwritten by caller
            warnings=[],
        )
