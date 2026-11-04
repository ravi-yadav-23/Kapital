import pytest
from app.services.optimizer_service import AllocationOptimizer
from app.services.report_service import report_service

def test_allocation_optimizer_basic():
    accounts = [
        {"id": "a1", "name": "Ravi", "available_liquid_balance": 100000.0, "is_active": True},
        {"id": "a2", "name": "Mohan", "available_liquid_balance": 500000.0, "is_active": True},
    ]
    ipos = [
        {
            "id": "i1",
            "name": "Knowledge Realty Trust",
            "status": "open",
            "lot_size": 150,
            "price_band_max": 100.0,
            "min_investment": 15000.0,
            "score": 85,
            "gmp_percent": 25.0,
        }
    ]
    plan = AllocationOptimizer.solve_allocation(accounts, ipos)
    assert plan.status == "OPTIMAL"
    assert plan.total_capital_deployed > 0
    assert len(plan.entries) > 0

def test_weighted_scoring_formula():
    score = report_service.compute_weighted_score(
        financial_quality=90,
        industry_tailwinds=80,
        subscription_momentum=75,
        valuation_safety=85,
        gmp_strength=80,
        promoter_integrity=90,
        penalties=0,
    )
    assert score >= 80
    assert report_service.get_recommendation(score) == "STRONG_APPLY"

def test_scoring_with_penalties():
    score = report_service.compute_weighted_score(
        financial_quality=50,
        industry_tailwinds=50,
        subscription_momentum=40,
        valuation_safety=40,
        gmp_strength=30,
        promoter_integrity=50,
        penalties=20,
    )
    assert score < 50
    assert report_service.get_recommendation(score) in ["WATCH", "AVOID"]


def test_asba_capital_reservation_and_conflicts():
    from datetime import date, timedelta
    today = date.today()

    accounts = [
        {"id": "a1", "name": "Ravi", "available_liquid_balance": 500000.0, "is_active": True, "preferred_category": "SHNI"},
        {"id": "a2", "name": "Papa", "available_liquid_balance": 200000.0, "is_active": True, "preferred_category": "RETAIL"},
    ]
    ipos = [
        {
            "id": "i1",
            "name": "Paras Healthcare",
            "status": "open",
            "issue_open_date": str(today - timedelta(days=1)),
            "issue_close_date": str(today + timedelta(days=1)),
            "allotment_date": str(today + timedelta(days=6)),
            "refund_date": str(today + timedelta(days=8)),
            "lot_size": 100,
            "price_band_max": 150.0,
            "min_investment": 15000.0,
            "score": 72,
            "gmp_percent": 18.0,
        },
        {
            "id": "i2",
            "name": "Zetwerk Manufacturing",
            "status": "upcoming",
            "issue_open_date": str(today + timedelta(days=5)),
            "issue_close_date": str(today + timedelta(days=7)),
            "allotment_date": str(today + timedelta(days=13)),
            "refund_date": str(today + timedelta(days=15)),
            "lot_size": 50,
            "price_band_max": 300.0,
            "min_investment": 15000.0,
            "score": 82,
            "gmp_percent": 35.0,
        },
    ]

    plan = AllocationOptimizer.solve_allocation(accounts, ipos)
    assert plan.status == "OPTIMAL"
    assert plan.asba_lock_overlaps_detected == 2
    assert len(plan.upcoming_conflicts) == 1
    assert plan.upcoming_conflicts[0].upcoming_ipo_name == "Zetwerk Manufacturing"
    assert len(plan.warnings) >= 2
    # Check that capital was not over-allocated
    ravi_entries = [e for e in plan.entries if e.account_id == "a1"]
    assert len(ravi_entries) == 1
    assert ravi_entries[0].amount <= 500000.0


def test_sme_ipo_allocation_and_share_calculations():
    """Verify that SME IPOs enforce SEBI minimum 2-lot threshold (>= 2L) and compute accurate share counts."""
    accounts = [
        {"id": "a_ramesh", "name": "Ramesh", "available_liquid_balance": 300000.0, "is_active": True, "preferred_category": "RETAIL"},
        {"id": "a_sunita", "name": "Sunita", "available_liquid_balance": 150000.0, "is_active": True, "preferred_category": "RETAIL"},
    ]
    ipos = [
        {
            "id": "ipo_vedant",
            "name": "Vedant Poly Fabs Solutions SME",
            "type": "SME",
            "status": "open",
            "lot_size": 1200,
            "price_band_min": 88.0,
            "price_band_max": 94.0,
            "min_investment": 225600.0,
            "score": 60,
            "gmp_percent": 16.0,
        }
    ]

    plan = AllocationOptimizer.solve_allocation(accounts, ipos)
    assert plan.status == "OPTIMAL"
    # Ramesh has >= 2.25L so he qualifies for the SME minimum 2-lot allocation
    ramesh_alloc = [e for e in plan.entries if e.account_id == "a_ramesh"]
    assert len(ramesh_alloc) == 1
    assert ramesh_alloc[0].lots == 2
    assert ramesh_alloc[0].shares == 2400
    assert ramesh_alloc[0].lot_size == 1200
    assert ramesh_alloc[0].amount == 225600.0

    # Sunita only has 1.5L available, so she must NOT be allocated (below the SEBI SME 2L minimum)
    sunita_alloc = [e for e in plan.entries if e.account_id == "a_sunita"]
    assert len(sunita_alloc) == 0


