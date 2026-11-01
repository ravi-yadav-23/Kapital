"""
Kapitl Demo Dataset Service
Provides a single deterministic, mathematically reconciled mock dataset for guest mode.

Reconciliation Invariants (strictly verified by unit tests):
1. total_family_balance == sum(a.total_balance for a in accounts)
2. total_locked_asba == sum(o.amount for o in orders if o.status in ["APPLIED", "CONFIRMED"])
3. total_available == total_family_balance - total_locked_asba
4. active_allotments == [alt for alt in allotments if alt.status == "ACTIVE"]
5. total_realized_pnl == sum(alt.realized_pnl for alt in allotments if alt.status == "SOLD")
6. allotment_rate == (total_allotments / total_bids) * 100
7. sum(lock.amount for lock in asba_locks) == total_locked_asba
"""

from typing import List, Dict, Any
from app.schemas.fund import FundSummaryResponse, PnlSummaryResponse
from app.schemas.account import AccountResponse
from app.schemas.order import OrderResponse
from app.schemas.allotment import AllotmentResponse, AsbaLockResponse

# 6 Family Accounts
DEMO_ACCOUNTS: List[Dict[str, Any]] = [
    {
        "id": "demo-acc-1",
        "name": "Ramesh Yadav",
        "relation": "Self",
        "angel_client_id": "DEMO_01",
        "total_balance": 700000.0,
        "available_balance": 287224.0,
        "locked_balance": 412776.0,
        "total_applied_ipos": 2,
        "total_allotments": 2,
        "total_realized_pnl": 141750.0,
        "allotment_rate": 100.0,
        "preferred_category": "SHNI",
        "is_active": True,
    },
    {
        "id": "demo-acc-2",
        "name": "Sunita Yadav",
        "relation": "Spouse",
        "angel_client_id": "DEMO_02",
        "total_balance": 300000.0,
        "available_balance": 152580.0,
        "locked_balance": 147420.0,
        "total_applied_ipos": 2,
        "total_allotments": 1,
        "total_realized_pnl": 17820.0,
        "allotment_rate": 50.0,
        "preferred_category": "RETAIL",
        "is_active": True,
    },
    {
        "id": "demo-acc-3",
        "name": "Vikram Yadav",
        "relation": "Brother",
        "angel_client_id": "DEMO_03",
        "total_balance": 100000.0,
        "available_balance": 80196.0,
        "locked_balance": 19804.0,
        "total_applied_ipos": 1,
        "total_allotments": 1,
        "total_realized_pnl": 0.0,
        "allotment_rate": 100.0,
        "preferred_category": "RETAIL",
        "is_active": True,
    },
    {
        "id": "demo-acc-4",
        "name": "Kavita Yadav",
        "relation": "Sister",
        "angel_client_id": "DEMO_04",
        "total_balance": 100000.0,
        "available_balance": 100000.0,
        "locked_balance": 0.0,
        "total_applied_ipos": 1,
        "total_allotments": 1,
        "total_realized_pnl": 0.0,
        "allotment_rate": 100.0,
        "preferred_category": "RETAIL",
        "is_active": True,
    },
    {
        "id": "demo-acc-5",
        "name": "Om Prakash Yadav",
        "relation": "Father",
        "angel_client_id": "DEMO_05",
        "total_balance": 100000.0,
        "available_balance": 100000.0,
        "locked_balance": 0.0,
        "total_applied_ipos": 0,
        "total_allotments": 0,
        "total_realized_pnl": 0.0,
        "allotment_rate": 0.0,
        "preferred_category": "RETAIL",
        "is_active": True,
    },
    {
        "id": "demo-acc-6",
        "name": "Shanti Devi",
        "relation": "Mother",
        "angel_client_id": "DEMO_06",
        "total_balance": 100000.0,
        "available_balance": 100000.0,
        "locked_balance": 0.0,
        "total_applied_ipos": 0,
        "total_allotments": 0,
        "total_realized_pnl": 0.0,
        "allotment_rate": 0.0,
        "preferred_category": "RETAIL",
        "is_active": True,
    },
]

# Orders (3 Active locked in APPLIED/CONFIRMED + 3 Historical won/allotted + 1 Unallocated)
DEMO_ORDERS: List[Dict[str, Any]] = [
    {
        "id": "ord-demo-1",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Ramesh Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "category": "SHNI",
        "lots": 28,
        "shares": 756,
        "bid_price": 546.0,
        "amount": 412776.0,
        "upi_vpa": "ramesh.yadav@okhdfcbank",
        "angel_order_id": "ANG_IPO_88102",
        "status": "CONFIRMED",
        "reject_reason": None,
        "placed_at": "2026-10-31 13:20:00",
    },
    {
        "id": "ord-demo-2",
        "account_id": "demo-acc-2",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Sunita Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "category": "RETAIL",
        "lots": 10,
        "shares": 270,
        "bid_price": 546.0,
        "amount": 147420.0,
        "upi_vpa": "sunita.yadav@okaxis",
        "angel_order_id": "ANG_IPO_88103",
        "status": "CONFIRMED",
        "reject_reason": None,
        "placed_at": "2026-10-31 14:14:00",
    },
    {
        "id": "ord-demo-3",
        "account_id": "demo-acc-3",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Vikram Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "category": "RETAIL",
        "lots": 1,
        "shares": 36,
        "bid_price": 550.11,
        "amount": 19804.0,
        "upi_vpa": "vikram.yadav@oksbi",
        "angel_order_id": "ANG_IPO_88104",
        "status": "APPLIED",
        "reject_reason": None,
        "placed_at": "2026-10-31 15:20:00",
    },
    {
        "id": "ord-demo-4",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-bonfiglioli",
        "account_name": "Ramesh Yadav",
        "ipo_name": "Bonfiglioli Transmissions Ltd",
        "category": "SHNI",
        "lots": 14,
        "shares": 350,
        "bid_price": 586.0,
        "amount": 205100.0,
        "upi_vpa": "ramesh.yadav@okhdfcbank",
        "angel_order_id": "ANG_IPO_77401",
        "status": "ALLOTTED",
        "reject_reason": None,
        "placed_at": "2026-10-25 10:30:00",
    },
    {
        "id": "ord-demo-5",
        "account_id": "demo-acc-4",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Kavita Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "category": "RETAIL",
        "lots": 1,
        "shares": 21,
        "bid_price": 546.0,
        "amount": 11466.0,
        "upi_vpa": "kavita.yadav@okicici",
        "angel_order_id": "ANG_IPO_77402",
        "status": "ALLOTTED",
        "reject_reason": None,
        "placed_at": "2026-10-26 11:15:00",
    },
    {
        "id": "ord-demo-6",
        "account_id": "demo-acc-3",
        "ipo_id": "ipo-krn-heat",
        "account_name": "Vikram Yadav",
        "ipo_name": "KRN Heat Exchanger Ltd",
        "category": "RETAIL",
        "lots": 1,
        "shares": 65,
        "bid_price": 220.0,
        "amount": 14300.0,
        "upi_vpa": "vikram.yadav@oksbi",
        "angel_order_id": "ANG_IPO_77403",
        "status": "ALLOTTED",
        "reject_reason": None,
        "placed_at": "2026-10-20 09:45:00",
    },
    {
        "id": "ord-demo-7",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-waaree-energies",
        "account_name": "Ramesh Yadav",
        "ipo_name": "Waaree Energies Ltd",
        "category": "SHNI",
        "lots": 9,
        "shares": 135,
        "bid_price": 1503.0,
        "amount": 202905.0,
        "upi_vpa": "ramesh.yadav@okhdfcbank",
        "angel_order_id": "ANG_IPO_66301",
        "status": "ALLOTTED",
        "reject_reason": None,
        "placed_at": "2024-10-25 10:00:00",
    },
    {
        "id": "ord-demo-8",
        "account_id": "demo-acc-2",
        "ipo_id": "ipo-premier-energies",
        "account_name": "Sunita Yadav",
        "ipo_name": "Premier Energies Ltd",
        "category": "RETAIL",
        "lots": 1,
        "shares": 33,
        "bid_price": 450.0,
        "amount": 14850.0,
        "upi_vpa": "sunita.yadav@okaxis",
        "angel_order_id": "ANG_IPO_66302",
        "status": "ALLOTTED",
        "reject_reason": None,
        "placed_at": "2024-08-30 10:00:00",
    },
]

# ASBA Locks (Reconciles exactly with orders in APPLIED/CONFIRMED: sum = 5,80,000.0)
DEMO_ASBA_LOCKS: List[Dict[str, Any]] = [
    {
        "id": "lock-demo-1",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Ramesh Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "amount": 412776.0,
        "lock_date": "2026-10-31",
        "release_date": "2026-11-03",
        "next_ipo_conflict": None,
        "is_conflict": False,
    },
    {
        "id": "lock-demo-2",
        "account_id": "demo-acc-2",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Sunita Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "amount": 147420.0,
        "lock_date": "2026-10-31",
        "release_date": "2026-11-03",
        "next_ipo_conflict": None,
        "is_conflict": False,
    },
    {
        "id": "lock-demo-3",
        "account_id": "demo-acc-3",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Vikram Yadav",
        "ipo_name": "Tonbo Imaging India Ltd",
        "amount": 19804.0,
        "lock_date": "2026-10-31",
        "release_date": "2026-11-03",
        "next_ipo_conflict": None,
        "is_conflict": False,
    },
]

# Allotments (3 Active awaiting listing + 2 Sold liquidated)
DEMO_ALLOTMENTS: List[Dict[str, Any]] = [
    {
        "id": "alt-demo-1",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-bonfiglioli",
        "account_name": "Ramesh Yadav",
        "angel_client_id": "DEMO_01",
        "ipo_name": "Bonfiglioli Transmissions Ltd",
        "ipo_symbol": "BONFIGLIOL",
        "allotted_shares": 350,
        "issue_price": 586.0,
        "invested_amount": 205100.0,
        "status": "ACTIVE",
        "current_price": 716.0,
        "listing_date": "2026-11-06",
        "staged_sell_limit_price": 716.0,
        "sell_order_id": None,
        "sell_price": None,
        "sell_date": None,
        "realized_pnl": None,
        "roi_percent": 22.2,
    },
    {
        "id": "alt-demo-2",
        "account_id": "demo-acc-4",
        "ipo_id": "ipo-tonbo-imaging",
        "account_name": "Kavita Yadav",
        "angel_client_id": "DEMO_04",
        "ipo_name": "Tonbo Imaging India Ltd",
        "ipo_symbol": "TONBO",
        "allotted_shares": 21,
        "issue_price": 546.0,
        "invested_amount": 11466.0,
        "status": "ACTIVE",
        "current_price": 955.0,
        "listing_date": "2026-11-07",
        "staged_sell_limit_price": 955.0,
        "sell_order_id": None,
        "sell_price": None,
        "sell_date": None,
        "realized_pnl": None,
        "roi_percent": 74.9,
    },
    {
        "id": "alt-demo-3",
        "account_id": "demo-acc-3",
        "ipo_id": "ipo-krn-heat",
        "account_name": "Vikram Yadav",
        "angel_client_id": "DEMO_03",
        "ipo_name": "KRN Heat Exchanger Ltd",
        "ipo_symbol": "KRNHEAT",
        "allotted_shares": 65,
        "issue_price": 220.0,
        "invested_amount": 14300.0,
        "status": "ACTIVE",
        "current_price": 480.0,
        "listing_date": "2026-11-05",
        "staged_sell_limit_price": 480.0,
        "sell_order_id": None,
        "sell_price": None,
        "sell_date": None,
        "realized_pnl": None,
        "roi_percent": 118.2,
    },
    {
        "id": "alt-demo-4",
        "account_id": "demo-acc-1",
        "ipo_id": "ipo-waaree-energies",
        "account_name": "Ramesh Yadav",
        "angel_client_id": "DEMO_01",
        "ipo_name": "Waaree Energies Ltd",
        "ipo_symbol": "WAAREE",
        "allotted_shares": 135,
        "issue_price": 1503.0,
        "invested_amount": 202905.0,
        "status": "SOLD",
        "current_price": 2553.0,
        "listing_date": "2024-10-28",
        "staged_sell_limit_price": 2553.0,
        "sell_order_id": "SL_WAAREE_001",
        "sell_price": 2553.0,
        "sell_date": "2024-10-28",
        "realized_pnl": 141750.0,
        "roi_percent": 69.8,
    },
    {
        "id": "alt-demo-5",
        "account_id": "demo-acc-2",
        "ipo_id": "ipo-premier-energies",
        "account_name": "Sunita Yadav",
        "angel_client_id": "DEMO_02",
        "ipo_name": "Premier Energies Ltd",
        "ipo_symbol": "PREMIERENE",
        "allotted_shares": 33,
        "issue_price": 450.0,
        "invested_amount": 14850.0,
        "status": "SOLD",
        "current_price": 990.0,
        "listing_date": "2024-09-03",
        "staged_sell_limit_price": 990.0,
        "sell_order_id": "SL_PREMIER_001",
        "sell_price": 990.0,
        "sell_date": "2024-09-03",
        "realized_pnl": 17820.0,
        "roi_percent": 120.0,
    },
]


class DemoDatasetService:
    @staticmethod
    def get_accounts() -> List[AccountResponse]:
        return [AccountResponse(**acc) for acc in DEMO_ACCOUNTS]

    @staticmethod
    def get_orders() -> List[OrderResponse]:
        return [OrderResponse(**ord) for ord in DEMO_ORDERS]

    @staticmethod
    def get_asba_locks() -> List[AsbaLockResponse]:
        return [AsbaLockResponse(**lock) for lock in DEMO_ASBA_LOCKS]

    @staticmethod
    def get_allotments() -> List[AllotmentResponse]:
        return [AllotmentResponse(**alt) for alt in DEMO_ALLOTMENTS]

    @staticmethod
    def get_fund_summary() -> FundSummaryResponse:
        accounts = DEMO_ACCOUNTS
        total_balance = sum(a["total_balance"] for a in accounts)
        available = sum(a["available_balance"] for a in accounts)
        locked = sum(a["locked_balance"] for a in accounts)
        utilization = (locked / total_balance * 100.0) if total_balance > 0 else 0.0

        return FundSummaryResponse(
            total_family_balance=total_balance,
            total_available=available,
            total_locked_asba=locked,
            utilization_percent=round(utilization, 1),
            accounts_active=sum(1 for a in accounts if a["is_active"]),
            accounts_total=len(accounts),
            active_asba_locks=len(DEMO_ASBA_LOCKS),
        )

    @staticmethod
    def get_pnl_summary() -> PnlSummaryResponse:
        allotments = DEMO_ALLOTMENTS
        sold_allotments = [alt for alt in allotments if alt["status"] == "SOLD"]
        active_allotments = [alt for alt in allotments if alt["status"] == "ACTIVE"]

        total_realized_pnl = sum(alt["realized_pnl"] or 0.0 for alt in sold_allotments)
        total_invested_sold = sum(alt["invested_amount"] or 0.0 for alt in sold_allotments)
        overall_roi = (total_realized_pnl / total_invested_sold * 100.0) if total_invested_sold > 0 else 0.0

        # Total bids across all family accounts: 2+2+1+1+0+0 = 6
        total_bids = sum(a["total_applied_ipos"] for a in DEMO_ACCOUNTS)
        total_allotments = len(allotments) # 5 won
        allotment_rate = (total_allotments / total_bids * 100.0) if total_bids > 0 else 0.0

        return PnlSummaryResponse(
            total_realized_pnl=total_realized_pnl,
            overall_roi_percent=round(overall_roi, 1),
            total_allotments=total_allotments,
            total_holding=len(active_allotments),
            allotment_rate_percent=round(allotment_rate, 1),
        )


demo_dataset = DemoDatasetService()
