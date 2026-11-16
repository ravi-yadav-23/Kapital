"""F30: an unfinished MILP solve must not be reported as an OPTIMAL (empty) plan."""
from datetime import datetime, timedelta, timezone

import pulp

from app.services.optimizer_service import AllocationOptimizer

TODAY = datetime.now(timezone.utc).date()
ACCOUNTS = [{"id": "a1", "name": "A One", "available_liquid_balance": 500000.0,
             "preferred_category": "RETAIL", "is_active": True, "pan": "AAAAA1111A"}]
IPOS = [{"id": "i1", "name": "Alpha Ltd", "status": "open", "type": "EQ",
         "issue_open_date": str(TODAY), "issue_close_date": str(TODAY + timedelta(days=2)),
         "allotment_date": str(TODAY + timedelta(days=4)), "lot_size": 100,
         "price_band_min": 100.0, "price_band_max": 100.0, "min_investment": 10000.0,
         "gmp_percent": 30.0, "score": 80}]


def test_not_solved_status_falls_back_to_greedy_with_warning(monkeypatch):
    # make CBC "do nothing": status stays 0 == "Not Solved", variables stay None
    monkeypatch.setattr(pulp.LpProblem, "solve", lambda self, *a, **k: 0)
    plan = AllocationOptimizer.solve_allocation(ACCOUNTS, IPOS)
    assert plan.entries, "fallback heuristic should still produce a plan"
    assert any("heuristic" in w.lower() or "did not finish" in w.lower() for w in plan.warnings)


def test_normal_solve_has_no_fallback_warning():
    plan = AllocationOptimizer.solve_allocation(ACCOUNTS, IPOS)
    assert plan.entries
    assert not any("did not finish" in w.lower() for w in plan.warnings)


def test_account_with_a_live_application_is_not_offered_the_same_ipo_again():
    accounts = ACCOUNTS + [{"id": "a2", "name": "B Two", "available_liquid_balance": 500000.0,
                            "preferred_category": "RETAIL", "is_active": True, "pan": "BBBBB2222B"}]
    plan = AllocationOptimizer.solve_allocation(accounts, IPOS, existing_bids={("a1", "i1")})
    assert {e.account_id for e in plan.entries} == {"a2"}


def test_greedy_fallback_is_labelled_heuristic_and_skips_live_bids(monkeypatch):
    monkeypatch.setattr(pulp.LpProblem, "solve", lambda self, *a, **k: 0)
    accounts = ACCOUNTS + [{"id": "a2", "name": "B Two", "available_liquid_balance": 500000.0,
                            "preferred_category": "RETAIL", "is_active": True, "pan": "BBBBB2222B"}]
    plan = AllocationOptimizer.solve_allocation(accounts, IPOS, existing_bids={("a1", "i1")})
    assert plan.status == "HEURISTIC"
    assert {e.account_id for e in plan.entries} == {"a2"}
