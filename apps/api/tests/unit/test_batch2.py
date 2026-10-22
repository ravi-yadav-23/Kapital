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
