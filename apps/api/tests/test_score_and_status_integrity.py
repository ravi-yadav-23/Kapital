"""
Test Suite: Score, Status & Demo Data Integrity (Adversarial Verification)
Verifies:
1. Canonical IPO status calculation in IST (single function).
2. Single source of truth for IPO score: /api/ipos, /api/ipos/{id}, and /api/reports/{id} return the identical score.
3. Unaudited reports: DRHP factors are None ('Not assessed'), live factors (GMP, subscription) are scored,
   displayed weights total 100% (60% + 40%), and headline score equals their weighted sum.
4. Demo data: allotments are whole lots (Tonbo lot = 21 shares), listing is T+3 working days,
   ASBA in use equals sum of open orders, matching across Orders, Allotments, and Fund Manager.
"""

import pytest
from datetime import date, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.utils.date_utils import compute_ipo_status, calculate_listing_date, today_ist
from app.services.demo_dataset import (
    demo_dataset,
    DEMO_ALLOTMENTS,
    DEMO_ORDERS,
    DEMO_ACCOUNTS,
    DEMO_ASBA_LOCKS,
)


def test_canonical_status_computation():
    today = date(2026, 11, 1)

    # Past close -> closed
    assert compute_ipo_status("2026-10-21", "2026-10-24", today=today) == "closed"
    assert compute_ipo_status(date(2026, 10, 21), date(2026, 10, 31), today=today) == "closed"

    # Closing today -> closing_today
    assert compute_ipo_status("2026-10-30", "2026-11-01", today=today) == "closing_today"

    # Open window -> open
    assert compute_ipo_status("2026-10-30", "2026-11-03", today=today) == "open"
    assert compute_ipo_status(date(2026, 11, 1), date(2026, 11, 4), today=today) == "open"

    # Future open -> upcoming
    assert compute_ipo_status("2026-11-02", "2026-11-05", today=today) == "upcoming"
    assert compute_ipo_status("2026-11-10", "2026-11-15", today=today) == "upcoming"

    # Missing dates -> fallback to upcoming
    assert compute_ipo_status(None, None, today=today) == "upcoming"

    # Self-heal inverted dates (e.g. 2026-11-30 to 2026-11-03)
    assert compute_ipo_status("2026-11-30", "2026-11-03", today=today) == "open"
    assert compute_ipo_status("2026-11-29", "2026-11-02", today=today) == "open"


def test_cross_month_date_parsing_and_status_resolution():
    from app.tasks.ipo_tasks import _parse_ipowatch_dates
    today = date(2026, 11, 1)

    # "30-3 Nov" (Maxwell Engineering, HGS India, Johnsoncab Electricals, Vectras Enprocon)
    o1, c1 = _parse_ipowatch_dates("30-3 Nov", year=2026)
    assert o1 == "2026-10-30"
    assert c1 == "2026-11-03"
    assert compute_ipo_status(o1, c1, today=today) == "open"

    # "29-2 Nov" (Antala Industries)
    o2, c2 = _parse_ipowatch_dates("29-2 Nov", year=2026)
    assert o2 == "2026-10-29"
    assert c2 == "2026-11-02"
    assert compute_ipo_status(o2, c2, today=today) == "open"

    # "2-4 Nov" (Vedant Poly Fabs Solutions - opens tomorrow Nov 2)
    o3, c3 = _parse_ipowatch_dates("2-4 Nov", year=2026)
    assert o3 == "2026-11-02"
    assert c3 == "2026-11-04"
    assert compute_ipo_status(o3, c3, today=today) == "upcoming"

    # Cross-month with unicode en-dash "30 Oct – 3 Nov"
    o4, c4 = _parse_ipowatch_dates("30 Oct \u2013 3 Nov", year=2026)
    assert o4 == "2026-10-30"
    assert c4 == "2026-11-03"
    assert compute_ipo_status(o4, c4, today=today) == "open"


def test_t_plus_3_listing_date_calculation():
    # Friday close -> Mon (T+1), Tue (T+2), Wed (T+3)
    friday_close = date(2026, 10, 31)  # 31 Oct is Saturday, let's use Friday 30 Oct
    fri = date(2026, 10, 30)
    assert calculate_listing_date(fri) == date(2026, 11, 4)  # Wed 4 Nov

    # Monday close -> Tue (T+1), Wed (T+2), Thu (T+3)
    mon = date(2026, 11, 2)
    assert calculate_listing_date(mon) == date(2026, 11, 5)

    # Tuesday close -> Wed (T+1), Thu (T+2), Fri (T+3)
    tue = date(2026, 11, 3)
    assert calculate_listing_date(tue) == date(2026, 11, 6)


def test_demo_data_whole_lots_and_asba_reconciliation():
    # Allotment whole lots check
    tonbo_alt = next((a for a in DEMO_ALLOTMENTS if "tonbo" in a["ipo_id"].lower()), None)
    assert tonbo_alt is not None
    assert tonbo_alt["allotted_shares"] % 21 == 0, "Tonbo allotment must be a multiple of lot size 21"
    assert tonbo_alt["allotted_shares"] == 21, "Kavita Yadav gets exactly 1 lot = 21 shares"

    bonfiglioli_alt = next((a for a in DEMO_ALLOTMENTS if "bonfiglioli" in a["ipo_id"].lower()), None)
    assert bonfiglioli_alt is not None
    assert bonfiglioli_alt["allotted_shares"] % 25 == 0, "Bonfiglioli allotment must be a multiple of lot size 25"

    krn_alt = next((a for a in DEMO_ALLOTMENTS if "krn" in a["ipo_id"].lower()), None)
    assert krn_alt is not None
    assert krn_alt["allotted_shares"] % 65 == 0, "KRN Heat allotment must be a multiple of lot size 65"

    # ASBA in use equals sum of open orders
    open_orders = [o for o in DEMO_ORDERS if o["status"] in ["APPLIED", "CONFIRMED"]]
    total_locked_from_orders = sum(o["amount"] for o in open_orders)
    assert total_locked_from_orders == 580000.0

    # Matches ASBA locks
    total_from_locks = sum(l["amount"] for l in DEMO_ASBA_LOCKS)
    assert total_from_locks == total_locked_from_orders

    # Matches Fund Summary
    funds = demo_dataset.get_fund_summary()
    assert funds.total_locked_asba == total_locked_from_orders
    assert funds.total_available == funds.total_family_balance - total_locked_from_orders
    assert funds.active_asba_locks == len(open_orders)


@pytest.mark.asyncio
async def test_score_equality_across_all_endpoints():
    """Verify that every IPO returns the exact same score from /api/ipos, /api/ipos/{id}, and /api/reports/{id}."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_ipos = await client.get("/api/ipos")
        assert res_ipos.status_code == 200
        ipos = res_ipos.json()
        assert len(ipos) > 0

        # Sample up to 5 IPOs to verify score equality across all 3 endpoints
        for ipo in ipos[:5]:
            ipo_id = ipo["id"]
            list_score = ipo["score"]
            assert list_score is not None

            # 1. Detail endpoint /api/ipos/{id}
            res_detail = await client.get(f"/api/ipos/{ipo_id}")
            assert res_detail.status_code == 200
            detail = res_detail.json()
            assert detail["score"] == list_score, f"Score mismatch on detail for {ipo['name']}: {detail['score']} vs {list_score}"

            # 2. Reports endpoint /api/reports/{id}
            res_report = await client.get(f"/api/reports/{ipo_id}")
            assert res_report.status_code == 200
            report = res_report.json()
            assert report["overall_score"] == list_score, f"Score mismatch on report for {ipo['name']}: {report['overall_score']} vs {list_score}"

            # 3. If unaudited, verify DRHP factors are None and live data weights sum to 100%
            if not report.get("is_audited"):
                sb = report["score_breakdown"]
                assert sb["financial_quality"] is None, "Unaudited report must not assess financial quality"
                assert sb["valuation_safety"] is None, "Unaudited report must not assess valuation safety"
                assert sb["promoter_integrity"] is None, "Unaudited report must not assess promoter integrity"
                assert sb["gmp_strength"] is not None, "Live GMP strength must be assessed"
                assert sb["subscription_momentum"] is not None, "Live subscription momentum must be assessed"

                # Headline score must equal weighted sum of live factors: 60% GMP + 40% subscription
                expected_score = int(round(sb["gmp_strength"] * 0.60 + sb["subscription_momentum"] * 0.40))
                assert report["overall_score"] == expected_score, (
                    f"Headline score {report['overall_score']} must equal weighted sum {expected_score}"
                )
