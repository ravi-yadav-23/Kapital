"""F01 / D8: a bid must never be reported as placed unless it really was."""
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import delete, select

from app.config import settings
from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.schemas.order import OrderCreate
from app.services.angel_service import angel_service
from app.services.order_service import order_service


@pytest.fixture(autouse=True)
def _dev_env_no_sessions(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(angel_service, "sessions", {})


async def _apply(client_id):
    return await angel_service.apply_ipo(client_id, "SAFE", 1, 100, 100.0, "u@upi", "RETAIL")


@pytest.mark.asyncio
async def test_real_client_without_session_is_not_simulated_in_development():
    res = await _apply("REAL_CLIENT_X1")
    assert res["success"] is False
    assert not res.get("is_simulation")


@pytest.mark.asyncio
async def test_demo_client_ids_are_still_simulated_and_flagged():
    res = await _apply("DEMO_FAMILY_1")
    assert res["success"] is True
    assert res["is_simulation"] is True


@pytest.mark.asyncio
async def test_live_ipo_apply_is_disabled_until_endpoint_verified(monkeypatch):
    monkeypatch.setattr(settings, "enable_live_ipo_apply", False)
    angel_service.sessions["REAL_CLIENT_X2"] = {"jwtToken": "t", "api_key": "k"}

    class Boom:
        def __init__(self, *a, **k):
            raise AssertionError("no HTTP request may be made while live IPO apply is disabled")

    with patch("app.services.angel_service.httpx.AsyncClient", Boom):
        res = await _apply("REAL_CLIENT_X2")
    assert res["success"] is False
    assert "not enabled" in res["error"].lower()


@pytest.mark.asyncio
async def test_failed_real_bid_does_not_lock_funds(db_session):
    db = db_session
    await db.execute(delete(IpoOrder).where(IpoOrder.account_id == "safe-acc"))
    acc = FamilyAccount(id="safe-acc", name="Safe Real", relation="Self", angel_client_id="SAFEREAL1",
                        total_demat_balance=500000.0, available_liquid_balance=500000.0,
                        locked_asba_balance=0.0)
    ipo = Ipo(id="safe-ipo", symbol="SAFE", name="Safe Ltd", slug="safe-ltd", type="EQ", status="open",
              price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
              issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2),
              listing_date=date.today() + timedelta(days=6), score=70)
    db.add_all([acc, ipo])
    await db.commit()
    try:
        with pytest.raises(ValueError):
            await order_service.create_order(db, OrderCreate(
                account_id="safe-acc", ipo_id="safe-ipo", lots=1, upi_vpa="a@upi", category="RETAIL"))
        await db.refresh(acc)
        assert acc.available_liquid_balance == 500000.0
        assert acc.locked_asba_balance == 0.0
        locks = (await db.execute(select(AsbaLock).where(AsbaLock.account_id == "safe-acc"))).scalars().all()
        assert locks == []
    finally:
        await db.rollback()
        await db.execute(delete(IpoOrder).where(IpoOrder.account_id == "safe-acc"))
        await db.execute(delete(AsbaLock).where(AsbaLock.account_id == "safe-acc"))
        await db.execute(delete(FamilyAccount).where(FamilyAccount.id == "safe-acc"))
        await db.execute(delete(Ipo).where(Ipo.id == "safe-ipo"))
        await db.commit()
