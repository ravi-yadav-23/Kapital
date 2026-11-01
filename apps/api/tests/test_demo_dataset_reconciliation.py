"""
Unit Test: Demo Dataset Mathematical Reconciliation (Phase 0)

Enforces that guest mode data across Dashboard, Fund Manager, Orders, and Allotments
cannot contradict each other under any circumstances.
"""

import pytest
from app.services.demo_dataset import demo_dataset, DEMO_ACCOUNTS, DEMO_ORDERS, DEMO_ALLOTMENTS, DEMO_ASBA_LOCKS


def test_demo_fund_summary_reconciliation():
    """Verify that Total Corpus = Available Liquid + ASBA Locked."""
    summary = demo_dataset.get_fund_summary()
    accounts = demo_dataset.get_accounts()

    # Rule 1: Corpus == sum of account balances
    expected_corpus = sum(a.total_balance for a in accounts)
    assert summary.total_family_balance == expected_corpus
    assert summary.total_family_balance == 1400000.0

    # Rule 2: Locked == sum of amounts on orders in APPLIED or CONFIRMED status
    orders = demo_dataset.get_orders()
    active_locked_orders = [o for o in orders if o.status in ["APPLIED", "CONFIRMED"]]
    expected_locked = sum(o.amount for o in active_locked_orders)
    assert summary.total_locked_asba == expected_locked
    assert summary.total_locked_asba == 580000.0

    # Rule 3: Available == Corpus - Locked
    assert summary.total_available == summary.total_family_balance - summary.total_locked_asba
    assert summary.total_available == 820000.0

    # Rule 4: Sum of account available balances == total available
    sum_acc_available = sum(a.available_balance for a in accounts)
    assert sum_acc_available == summary.total_available

    # Rule 5: Sum of account locked balances == total locked
    sum_acc_locked = sum(a.locked_balance for a in accounts)
    assert sum_acc_locked == summary.total_locked_asba


def test_demo_asba_locks_reconciliation():
    """Verify that ASBA lock records sum exactly to the total locked ASBA funds."""
    locks = demo_dataset.get_asba_locks()
    summary = demo_dataset.get_fund_summary()

    total_asba_locks = sum(l.amount for l in locks)
    assert total_asba_locks == summary.total_locked_asba
    assert total_asba_locks == 580000.0

    # Every lock corresponds to an account in the demo accounts list
    accounts = {a.id for a in demo_dataset.get_accounts()}
    for lock in locks:
        assert lock.account_id in accounts


def test_demo_allotments_and_pnl_reconciliation():
    """Verify that active allotments, sold allotments, and realized P&L match Orders and PnL Summary."""
    pnl = demo_dataset.get_pnl_summary()
    allotments = demo_dataset.get_allotments()

    # Active allotments (awaiting listing day execution)
    active_allotments = [alt for alt in allotments if alt.status == "ACTIVE"]
    assert pnl.total_holding == len(active_allotments)
    assert len(active_allotments) == 3

    # Sold allotments (liquidated gains)
    sold_allotments = [alt for alt in allotments if alt.status == "SOLD"]
    expected_realized_pnl = sum(alt.realized_pnl for alt in sold_allotments if alt.realized_pnl is not None)
    assert pnl.total_realized_pnl == expected_realized_pnl
    assert pnl.total_realized_pnl == 159570.0

    # Hit rate = allotted orders / applied orders
    total_bids = sum(a.total_applied_ipos for a in demo_dataset.get_accounts())
    total_won = len(allotments)
    expected_hit_rate = round((total_won / total_bids) * 100.0, 1)
    assert pnl.allotment_rate_percent == expected_hit_rate
    assert pnl.allotment_rate_percent == 83.3


def test_cross_module_account_and_order_integrity():
    """Verify that all Orders and Allotments reference valid demo family accounts."""
    account_ids = {a.id for a in demo_dataset.get_accounts()}
    orders = demo_dataset.get_orders()
    allotments = demo_dataset.get_allotments()

    for order in orders:
        assert order.account_id in account_ids

    for alt in allotments:
        assert alt.account_id in account_ids
