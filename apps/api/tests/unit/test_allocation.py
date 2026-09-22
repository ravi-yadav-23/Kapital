import pytest
from app.services.optimizer_service import AllocationOptimizer


def test_allocation_bhni_and_retail():
    accounts = [
        {
            "id": "acc-1",
            "name": "HNI Account",
            "available_liquid_balance": 1500000.0,
            "preferred_category": "bHNI",
            "is_active": True,
        },
        {
            "id": "acc-2",
            "name": "Retail Account",
            "available_liquid_balance": 50000.0,
            "preferred_category": "RETAIL",
            "is_active": True,
        },
    ]
    ipos = [
        {
            "id": "ipo-1",
            "name": "Mega IPO Ltd",
            "symbol": "MEGA",
            "status": "open",
            "lot_size": 100,
            "price_band_max": 150.0,
            "min_investment": 15000.0,
            "score": 85,
            "gmp_percent": 30.0,
        }
    ]

    plan = AllocationOptimizer.solve_allocation(accounts, ipos)
    assert plan.status == "OPTIMAL"
    assert len(plan.entries) == 2

    bhni_entries = [e for e in plan.entries if e.category == "bHNI"]
    retail_entries = [e for e in plan.entries if e.category == "RETAIL"]

    assert len(bhni_entries) == 1
    assert bhni_entries[0].amount > 1000000.0
    assert len(retail_entries) == 1
    assert retail_entries[0].amount <= 200000.0
