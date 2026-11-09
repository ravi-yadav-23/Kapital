import pytest
from datetime import date, timedelta
from unittest.mock import patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.account import FamilyAccount
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.models.allotment import Allotment, AsbaLock
from app.services.order_service import order_service
from app.services.allotment_service import allotment_service


@pytest.mark.asyncio
async def test_partial_allotment_unblocks_excess_funds(db_session: AsyncSession):
    """
    Test that in a partial allotment scenario (e.g. sHNI/bHNI with oversubscription):
    - Allotted shares and invested amount match the credited quantity.
    - The excess blocked ASBA funds are refunded back to liquid balance.
    - ASBA lock record is cleaned up.
    """
    # 1. Setup account
    acc = FamilyAccount(
        id="acc-partial-1",
        name="HNI Investor",
        relation="Self",
        pan="ABCDE1234F",
        available_liquid_balance=100000.0,
        locked_asba_balance=200000.0,
        angel_client_id="R-ALT-01",
    )
    db_session.add(acc)

    # 2. Setup IPO
    ipo = Ipo(
        id="ipo-partial-1",
        name="Tech Giant Ltd",
        slug="tech-giant",
        symbol="TECHG",
        isin="INE123T01010",
        price_band_min=1000.0,
        price_band_max=1000.0,
        lot_size=10,
        min_investment=10000.0,
        status="CLOSED",
    )
    db_session.add(ipo)

    # 3. Setup Order for 200 shares @ ₹1,000 = ₹200,000
    order = IpoOrder(
        id="ord-partial-1",
        account_id=acc.id,
        ipo_id=ipo.id,
        account_name=acc.name,
        ipo_name=ipo.name,
        category="sHNI",
        lots=20,
        shares=200,
        bid_price=1000.0,
        amount=200000.0,
        upi_vpa="test@okhdfcbank",
        status="SUBMITTED",
        mandate_status="LOCKED",
    )
    db_session.add(order)

    # 4. Setup AsbaLock
    lock = AsbaLock(
        id="lock-partial-1",
        account_id=acc.id,
        ipo_id=ipo.id,
        account_name=acc.name,
        ipo_name=ipo.name,
        amount=200000.0,
        lock_date=date.today(),
        release_date=date.today() + timedelta(days=3),
    )
    db_session.add(lock)
    await db_session.commit()

    # Process partial allotment: only 50 shares allotted out of 200 applied
    res = await order_service.process_allotment_result(
        db=db_session,
        order_id=order.id,
        result="ALLOTTED",
        allotted_qty=50,
    )

    assert res["success"] is True
    assert res["status"] == "ALLOTTED"
    assert res["allotted_shares"] == 50
    assert res["invested_amount"] == 50000.0
    assert res["refund_amount"] == 150000.0

    # Refresh DB objects
    await db_session.refresh(acc)
    await db_session.refresh(order)

    # Verify balances:
    # locked_asba_balance was 200k, now reduced to 0
    assert acc.locked_asba_balance == 0.0
    # available_liquid_balance was 100k, received 150k refund -> 250k
    assert acc.available_liquid_balance == 250000.0

    # Verify Allotment record
    stmt_alt = select(Allotment).where(Allotment.id == res["allotment_id"])
    alt_res = await db_session.execute(stmt_alt)
    alt = alt_res.scalar_one()
    assert alt.allotted_shares == 50
    assert alt.invested_amount == 50000.0

    # Verify lock removed
    stmt_lock = select(AsbaLock).where(AsbaLock.id == "lock-partial-1")
    lock_res = await db_session.execute(stmt_lock)
    assert lock_res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_allotment_detection_skips_on_broker_failure(db_session: AsyncSession):
    """
    Test that when angel_service returns None (network error or unauthenticated):
    - Orders are NOT marked NOT_ALLOTTED even if listing_date + 3 days has passed.
    - ASBA funds remain safely protected.
    """
    today = date.today()
    past_listing = today - timedelta(days=5)

    acc = FamilyAccount(
        id="acc-fail-1",
        name="Broker Fail User",
        relation="Self",
        pan="ABCDE5555F",
        available_liquid_balance=50000.0,
        locked_asba_balance=15000.0,
        angel_client_id="R-ALT-02",
    )
    db_session.add(acc)

    ipo = Ipo(
        id="ipo-fail-1",
        name="Delayed Scrip Ltd",
        slug="delayed-scrip",
        symbol="DELAY",
        isin="INE999D01010",
        listing_date=past_listing,
        allotment_date=past_listing - timedelta(days=2),
        price_band_min=100.0,
        price_band_max=100.0,
        lot_size=150,
        min_investment=15000.0,
        status="CLOSED",
    )
    db_session.add(ipo)

    order = IpoOrder(
        id="ord-fail-1",
        account_id=acc.id,
        ipo_id=ipo.id,
        account_name=acc.name,
        ipo_name=ipo.name,
        category="RETAIL",
        lots=1,
        shares=150,
        bid_price=100.0,
        amount=15000.0,
        upi_vpa="test@okhdfcbank",
        status="SUBMITTED",
        mandate_status="LOCKED",
    )
    db_session.add(order)
    await db_session.commit()

    # Simulate broker outage: get_all_holdings returns None
    with patch("app.services.allotment_service.angel_service.get_all_holdings", new_callable=AsyncMock) as mock_holdings:
        mock_holdings.return_value = None

        res = await allotment_service.auto_detect_allotments(db_session)

        assert res["not_allotted"] == 0
        assert res["allotted"] == 0
        assert res["pending"] >= 1

    await db_session.refresh(order)
    await db_session.refresh(acc)

    # Order must remain SUBMITTED, NOT flipped to NOT_ALLOTTED
    assert order.status == "SUBMITTED"
    assert acc.locked_asba_balance == 15000.0


@pytest.mark.asyncio
async def test_allotment_detection_marks_not_allotted_only_on_confirmed_empty_demat_past_buffer(db_session: AsyncSession):
    """
    Test that when broker successfully returns Demat holdings ([]):
    - If past listing_date + 3 days, it marks NOT_ALLOTTED and unlocks funds.
    """
    today = date.today()
    past_listing = today - timedelta(days=5)

    acc = FamilyAccount(
        id="acc-unallot-1",
        name="Unallotted User",
        relation="Self",
        pan="ABCDE7777F",
        available_liquid_balance=50000.0,
        locked_asba_balance=15000.0,
        angel_client_id="R-ALT-03",
    )
    db_session.add(acc)

    ipo = Ipo(
        id="ipo-unallot-1",
        name="Missed Scrip Ltd",
        slug="missed-scrip",
        symbol="MISSED",
        isin="INE444M01010",
        listing_date=past_listing,
        allotment_date=past_listing - timedelta(days=2),
        price_band_min=100.0,
        price_band_max=100.0,
        lot_size=150,
        min_investment=15000.0,
        status="CLOSED",
    )
    db_session.add(ipo)

    order = IpoOrder(
        id="ord-unallot-1",
        account_id=acc.id,
        ipo_id=ipo.id,
        account_name=acc.name,
        ipo_name=ipo.name,
        category="RETAIL",
        lots=1,
        shares=150,
        bid_price=100.0,
        amount=15000.0,
        upi_vpa="test@okhdfcbank",
        status="SUBMITTED",
        mandate_status="LOCKED",
    )
    db_session.add(order)
    await db_session.commit()

    # Simulate broker successfully returning empty demat holdings list []
    with patch("app.services.allotment_service.angel_service.get_all_holdings", new_callable=AsyncMock) as mock_holdings:
        mock_holdings.return_value = []

        res = await allotment_service.auto_detect_allotments(db_session)

        assert res["not_allotted"] >= 1

    await db_session.refresh(order)
    await db_session.refresh(acc)

    assert order.status == "NOT_ALLOTTED"
    assert acc.locked_asba_balance == 0.0
    assert acc.available_liquid_balance == 65000.0


@pytest.mark.asyncio
async def test_allotment_exact_matching_avoids_substring_false_positives(db_session: AsyncSession):
    """
    Test that an IPO with symbol 'TATA' does not match existing portfolio holding 'TATAMOTORS'.
    """
    today = date.today()

    acc = FamilyAccount(
        id="acc-sub-1",
        name="Tata Fan",
        relation="Self",
        pan="ABCDE8888F",
        available_liquid_balance=50000.0,
        locked_asba_balance=15000.0,
        angel_client_id="R-ALT-04",
    )
    db_session.add(acc)

    ipo = Ipo(
        id="ipo-sub-1",
        name="Tata Capital",
        slug="tata-capital",
        symbol="TATA",
        isin="INE000T01010",
        listing_date=today + timedelta(days=2),
        allotment_date=today - timedelta(days=1),
        price_band_min=100.0,
        price_band_max=100.0,
        lot_size=150,
        min_investment=15000.0,
        status="CLOSED",
    )
    db_session.add(ipo)

    order = IpoOrder(
        id="ord-sub-1",
        account_id=acc.id,
        ipo_id=ipo.id,
        account_name=acc.name,
        ipo_name=ipo.name,
        category="RETAIL",
        lots=1,
        shares=150,
        bid_price=100.0,
        amount=15000.0,
        upi_vpa="test@okhdfcbank",
        status="SUBMITTED",
        mandate_status="LOCKED",
    )
    db_session.add(order)
    await db_session.commit()

    # User already has TATAMOTORS in their Demat holding, with a completely different ISIN
    existing_holdings = [
        {
            "isin": "INE155A01022",
            "tradingsymbol": "TATAMOTORS-EQ",
            "symbolname": "Tata Motors Ltd",
            "totalqty": 100,
        }
    ]

    with patch("app.services.allotment_service.angel_service.get_all_holdings", new_callable=AsyncMock) as mock_holdings:
        mock_holdings.return_value = existing_holdings

        res = await allotment_service.auto_detect_allotments(db_session)

        # Must NOT be marked allotted because TATAMOTORS is not TATA!
        assert res["allotted"] == 0
        assert res["pending"] >= 1

    await db_session.refresh(order)
    assert order.status == "SUBMITTED"
