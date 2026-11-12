"""F10 / D4: cancel is a local bookkeeping action - restrict it to live orders and say so honestly."""
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import app
from app.middleware.auth import create_access_token
from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.services.order_service import order_service


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(FamilyAccount(id="cx-acc", name="Cancel", relation="Self", angel_client_id="CX1",
                            total_demat_balance=100000.0, available_liquid_balance=90000.0,
                            locked_asba_balance=10000.0))
        s.add(Ipo(id="cx-ipo", symbol="CXL", name="Cancel Ltd", slug="cancel", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  listing_date=date.today() + timedelta(days=5)))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(AsbaLock).where(AsbaLock.account_id == "cx-acc"))
        await s.execute(delete(IpoOrder).where(IpoOrder.account_id == "cx-acc"))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id == "cx-acc"))
        await s.execute(delete(Ipo).where(Ipo.id == "cx-ipo"))
        await s.commit()


async def _order(db, status):
    oid = f"cx-ord-{status}"
    db.add(IpoOrder(id=oid, account_id="cx-acc", ipo_id="cx-ipo", account_name="Cancel", ipo_name="Cancel Ltd",
                    lots=1, shares=100, bid_price=100.0, amount=10000.0, upi_vpa="a@upi", status=status))
    await db.commit()
    return oid


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["ALLOTTED", "NOT_ALLOTTED", "FAILED", "REJECTED"])
async def test_finished_orders_cannot_be_cancelled(db, status):
    oid = await _order(db, status)
    with pytest.raises(ValueError):
        await order_service.cancel_order(db, oid)
    acc = await db.get(FamilyAccount, "cx-acc")
    assert acc.available_liquid_balance == 90000.0 and acc.locked_asba_balance == 10000.0


@pytest.mark.asyncio
async def test_live_order_cancel_is_labelled_as_local_only(db):
    oid = await _order(db, "SUBMITTED")
    res = await order_service.cancel_order(db, oid)
    assert res.status == "CANCELLED"
    assert "broker" in (res.reject_reason or "").lower()
    acc = await db.get(FamilyAccount, "cx-acc")
    assert acc.available_liquid_balance == 100000.0 and acc.locked_asba_balance == 0.0


@pytest.mark.asyncio
async def test_api_returns_409_for_finished_order(db):
    oid = await _order(db, "ALLOTTED")
    tok = create_access_token({"sub": "admin-1", "role": "ADMIN", "is_guest": False})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post(f"/api/orders/{oid}/cancel", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 409
