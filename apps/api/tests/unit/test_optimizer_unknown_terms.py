"""M2b: an open IPO whose price band / lot size is not known must be skipped, never allocated with invented terms."""
from datetime import datetime, timedelta, timezone

from app.services.optimizer_service import AllocationOptimizer

TODAY = datetime.now(timezone.utc).date()
ACCOUNTS = [{"id": "a1", "name": "A One", "available_liquid_balance": 500000.0, "preferred_category": "RETAIL",
             "is_active": True, "pan": "AAAAA1111A"}]


def _ipo(i, **kw):
    base = {"id": i, "name": f"Ipo {i} Ltd", "status": "open", "type": "EQ", "issue_open_date": str(TODAY),
            "issue_close_date": str(TODAY + timedelta(days=2)), "allotment_date": str(TODAY + timedelta(days=4)),
            "lot_size": 100, "price_band_min": 100.0, "price_band_max": 100.0, "min_investment": 10000.0,
            "gmp_percent": 30.0, "score": 80}
    base.update(kw)
    return base


def test_ipo_without_known_terms_is_skipped_with_a_reason():
    unknown = _ipo("unk", lot_size=0, price_band_min=0.0, price_band_max=0.0, min_investment=0.0)
    plan = AllocationOptimizer.solve_allocation(ACCOUNTS, [unknown, _ipo("good")])
    assert {e.ipo_id for e in plan.entries} == {"good"}
    skipped = {s.ipo_id: s.reason for s in plan.skipped_ipos}
    assert "unk" in skipped and "not" in skipped["unk"].lower() and "known" in skipped["unk"].lower()


def test_only_unknown_terms_gives_no_allocation_not_an_invented_one():
    unknown = _ipo("unk", lot_size=0, price_band_min=0.0, price_band_max=0.0, min_investment=0.0)
    plan = AllocationOptimizer.solve_allocation(ACCOUNTS, [unknown])
    assert plan.entries == [] and [s.ipo_id for s in plan.skipped_ipos] == ["unk"]
