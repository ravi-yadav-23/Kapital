import pytest
from unittest.mock import patch
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.order_service import order_service
from app.schemas.order import OrderCreate
from app.models.account import FamilyAccount
from app.models.ipo import Ipo


@pytest.mark.asyncio
async def test_order_creation_insufficient_balance(db_session: AsyncSession):
    """Test that creating an order with insufficient balance raises ValueError."""
    acc = FamilyAccount(
        id="acc-broke-1",
        name="Broke User",
        relation="Self",
        angel_client_id="R999888",
        total_demat_balance=5000.0,
        available_liquid_balance=5000.0,
        locked_asba_balance=0.0,
        is_active=True,
    )
    ipo = Ipo(
        id="ipo-expensive-1",
        symbol="EXPENSIVE",
        name="Expensive Tech Ltd",
        slug="expensive-tech",
        type="EQ",
        status="open",
        price_band_min=500.0,
        price_band_max=500.0,
        lot_size=30,
        min_investment=15000.0,
        issue_open_date=date.today(),
        issue_close_date=date.today() + timedelta(days=2),
    )
    db_session.add(acc)
    db_session.add(ipo)
    await db_session.commit()

    # Required = 30 * 500 = 15,000 > available 5,000
    req = OrderCreate(
        account_id="acc-broke-1",
        ipo_id="ipo-expensive-1",
        category="RETAIL",
        lots=1,
        bid_price=500.0,
        upi_vpa="broke@okaxis",
    )

    with pytest.raises(ValueError, match="Insufficient liquid balance"):
        await order_service.create_order(db_session, req)


@pytest.mark.asyncio
async def test_order_creation_duplicate_pan_rejection(db_session: AsyncSession):
    """Test that creating duplicate active applications under the same account raises ValueError."""
    acc = FamilyAccount(
        id="acc-rich-1",
        name="Rich User",
        relation="Self",
        angel_client_id="R777666",
        total_demat_balance=500000.0,
        available_liquid_balance=500000.0,
        locked_asba_balance=0.0,
        is_active=True,
    )
    ipo = Ipo(
        id="ipo-popular-1",
        symbol="POPULAR",
        name="Popular Retail Ltd",
        slug="popular-retail",
        type="EQ",
        status="open",
        price_band_min=100.0,
        price_band_max=100.0,
        lot_size=100,
        min_investment=10000.0,
        issue_open_date=date.today(),
        issue_close_date=date.today() + timedelta(days=2),
    )
    db_session.add(acc)
    db_session.add(ipo)
    await db_session.commit()

    req = OrderCreate(
        account_id="acc-rich-1",
        ipo_id="ipo-popular-1",
        category="RETAIL",
        lots=1,
        bid_price=100.0,
        upi_vpa="rich@okicici",
    )

    # First bid succeeds
    order1 = await order_service.create_order(db_session, req)
    assert order1.id is not None

    # Duplicate bid for same account & IPO fails under SEBI single PAN rule
    with pytest.raises(ValueError, match="An active application already exists"):
        await order_service.create_order(db_session, req)


def test_optimizer_lot_cost_computation_edge_cases():
    """Verify that AllocationOptimizer handles zero lot cost safely and computes accurate sHNI/bHNI counts."""
    from app.services.optimizer_service import AllocationOptimizer

    # 1. Zero/missing lot cost defaults safely without ZeroDivisionError
    lot_cost, min_inv, shni_lots, bhni_lots = AllocationOptimizer._compute_lot_cost_and_lots({"lot_size": 0, "price_band_max": 0})
    assert lot_cost == 15000.0
    assert min_inv == 15000.0
    assert shni_lots == 14  # int(200000 / 15000) + 1 = 14
    assert bhni_lots == 67  # int(1000000 / 15000) + 1 = 67

    # 2. Large SME IPO lot cost (₹1,20,000 per lot)
    lot_cost_sme, _, shni_sme, bhni_sme = AllocationOptimizer._compute_lot_cost_and_lots({"min_investment": 120000.0, "lot_size": 1000, "price_band_max": 120.0})
    assert lot_cost_sme == 120000.0
    assert shni_sme == 2  # 2 lots * 120,000 = 240,000 (> 200,000, within 10L sHNI limit)
    assert bhni_sme == 9  # 9 lots * 120,000 = 1,080,000 (> 10L bHNI limit)


@pytest.mark.asyncio
async def test_order_creation_sebi_category_limits(db_session: AsyncSession):
    """Test that SEBI category bounds (Retail <= 2L, sHNI 2L-10L, bHNI > 10L) are enforced."""
    acc = FamilyAccount(
        id="acc-cat-test-1",
        name="Category Tester",
        relation="Self",
        angel_client_id="R991122",
        total_demat_balance=2000000.0,
        available_liquid_balance=2000000.0,
        locked_asba_balance=0.0,
        is_active=True,
    )
    ipo = Ipo(
        id="ipo-cat-test-1",
        symbol="CATTEST",
        name="Category Test Ltd",
        slug="cattest",
        type="EQ",
        status="open",
        price_band_min=100.0,
        price_band_max=100.0,
        lot_size=100,
        min_investment=10000.0,
        issue_open_date=date.today(),
        issue_close_date=date.today() + timedelta(days=2),
    )
    db_session.add(acc)
    db_session.add(ipo)
    await db_session.commit()

    # 1. Retail exceeding ₹2,00,000 (21 lots * 100 * 100 = ₹2,10,000)
    req_retail_over = OrderCreate(
        account_id="acc-cat-test-1",
        ipo_id="ipo-cat-test-1",
        category="RETAIL",
        lots=21,
        bid_price=100.0,
        upi_vpa="tester@upi",
    )
    with pytest.raises(ValueError, match="exceeds SEBI Retail ceiling of ₹2,00,000"):
        await order_service.create_order(db_session, req_retail_over)

    # 2. sHNI under ₹2,00,000 (10 lots * 100 * 100 = ₹1,00,000)
    req_shni_under = OrderCreate(
        account_id="acc-cat-test-1",
        ipo_id="ipo-cat-test-1",
        category="SHNI",
        lots=10,
        bid_price=100.0,
        upi_vpa="tester@upi",
    )
    with pytest.raises(ValueError, match="must be between ₹2,00,001 and ₹10,00,000"):
        await order_service.create_order(db_session, req_shni_under)

    # 3. bHNI under ₹10,00,000 (50 lots * 100 * 100 = ₹5,00,000)
    req_bhni_under = OrderCreate(
        account_id="acc-cat-test-1",
        ipo_id="ipo-cat-test-1",
        category="BHNI",
        lots=50,
        bid_price=100.0,
        upi_vpa="tester@upi",
    )
    with pytest.raises(ValueError, match="must exceed ₹10,00,000"):
        await order_service.create_order(db_session, req_bhni_under)


