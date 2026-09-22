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
