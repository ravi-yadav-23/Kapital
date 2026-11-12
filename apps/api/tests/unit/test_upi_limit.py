"""D3 / F06: UPI cannot carry a bid above Rs 5,00,000 - plans must say how to pay, and orders must refuse."""
from datetime import date, timedelta, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.schemas.fund import AllocationEntrySchema
from app.schemas.order import OrderCreate
from app.services.optimizer_service import AllocationOptimizer, UPI_IPO_LIMIT
from app.services.order_service import order_service

TODAY = datetime.now(timezone.utc).date()


def _entry(amount):
    return AllocationEntrySchema(account_id="a", account_name="A", ipo_id="i", ipo_name="I", category="sHNI",
                                 lots=1, amount=amount, expected_return_pct=10.0)


def test_limit_constant_is_five_lakh():
    assert UPI_IPO_LIMIT == 500_000.0


def test_entry_payment_method_follows_amount():
    assert _entry(499_999.0).payment_method == "UPI"
    assert _entry(500_000.0).payment_method == "UPI"
    assert _entry(500_001.0).payment_method == "NET_BANKING_ASBA"


def test_explicit_payment_method_is_respected():
    e = AllocationEntrySchema(account_id="a", account_name="A", ipo_id="i", ipo_name="I", category="RETAIL",
                              lots=1, amount=1000.0, expected_return_pct=1.0, payment_method="NET_BANKING_ASBA")
    assert e.payment_method == "NET_BANKING_ASBA"


def test_optimizer_plan_tags_large_bids_as_net_banking():
    accounts = [{"id": "a1", "name": "Rich", "available_liquid_balance": 3_000_000.0,
                 "preferred_category": "bHNI", "is_active": True, "pan": "AAAAA1111A"}]
    ipos = [{"id": "i1", "name": "Alpha Ltd", "status": "open", "type": "EQ",
             "issue_open_date": str(TODAY), "issue_close_date": str(TODAY + timedelta(days=2)),
             "allotment_date": str(TODAY + timedelta(days=4)), "lot_size": 100, "price_band_min": 100.0,
             "price_band_max": 100.0, "min_investment": 10000.0, "gmp_percent": 40.0, "score": 90}]
    plan = AllocationOptimizer.solve_allocation(accounts, ipos)
    assert plan.entries
    for e in plan.entries:
        expected = "UPI" if e.amount <= UPI_IPO_LIMIT else "NET_BANKING_ASBA"
        assert e.payment_method == expected


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(FamilyAccount(id="upi-acc", name="Upi", relation="Self", angel_client_id="UPI1", pan="UPIPN1234U",
                            total_demat_balance=3_000_000.0, available_liquid_balance=3_000_000.0))
        s.add(Ipo(id="upi-ipo", symbol="UPI", name="Upi Ltd", slug="upi", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2),
                  listing_date=date.today() + timedelta(days=6)))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(AsbaLock).where(AsbaLock.account_id == "upi-acc"))
        await s.execute(delete(IpoOrder).where(IpoOrder.account_id == "upi-acc"))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id == "upi-acc"))
        await s.execute(delete(Ipo).where(Ipo.id == "upi-ipo"))
        await s.commit()


@pytest.mark.asyncio
async def test_order_above_upi_limit_is_rejected_before_the_broker(db):
    broker = AsyncMock(return_value={"success": True, "broker_order_id": "B", "status": "SUBMITTED"})
    with patch("app.services.order_service.angel_service.apply_ipo", new=broker):
        with pytest.raises(ValueError, match="UPI"):
            await order_service.create_order(db, OrderCreate(
                account_id="upi-acc", ipo_id="upi-ipo", lots=60, upi_vpa="a@upi", category="sHNI"))
    broker.assert_not_awaited()


@pytest.mark.asyncio
async def test_order_at_or_below_limit_is_accepted(db):
    ok = {"success": True, "broker_order_id": "B", "status": "SUBMITTED", "mandate_status": "REQUESTED"}
    with patch("app.services.order_service.angel_service.apply_ipo", new=AsyncMock(return_value=ok)):
        res = await order_service.create_order(db, OrderCreate(
            account_id="upi-acc", ipo_id="upi-ipo", lots=50, upi_vpa="a@upi", category="sHNI"))
    assert res.amount == 500_000.0
