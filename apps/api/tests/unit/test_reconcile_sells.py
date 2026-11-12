"""F02: realized P&L may only be booked from a real, full broker fill."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import Allotment
from app.models.ipo import Ipo
from app.models.pnl import RealizedPnl
from app.services.angel_service import angel_service
from app.tasks import scheduler


@pytest_asyncio.fixture
async def staged(test_engine, monkeypatch):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    monkeypatch.setattr("app.db.database.AsyncSessionLocal", maker)
    monkeypatch.setattr(scheduler, "_in_memory_job_locks", {})
    monkeypatch.setattr(angel_service, "sessions", {})

    def _no_redis(*a, **k):
        raise ConnectionError("redis disabled in unit test")

    monkeypatch.setattr("redis.asyncio.from_url", _no_redis)
    async with maker() as s:
        s.add(FamilyAccount(id="rec-acc", name="Rec", relation="Self", angel_client_id="RECCLIENT1"))
        s.add(Ipo(id="rec-ipo", symbol="RECO", name="Reco Ltd", slug="reco", type="EQ", status="listed",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0))
        await s.flush()
        s.add(Allotment(id="rec-alt", account_id="rec-acc", ipo_id="rec-ipo", account_name="Rec",
                        angel_client_id="RECCLIENT1", ipo_name="Reco Ltd", ipo_symbol="RECO",
                        allotted_shares=100, issue_price=100.0, invested_amount=10000.0, status="STAGED",
                        listing_date=date.today(), staged_sell_limit_price=150.0, sell_order_id="SELL-REAL-1"))
        await s.commit()
    yield maker
    async with maker() as s:
        await s.execute(delete(RealizedPnl).where(RealizedPnl.allotment_id == "rec-alt"))
        await s.execute(delete(Allotment).where(Allotment.id == "rec-alt"))
        await s.execute(delete(Ipo).where(Ipo.id == "rec-ipo"))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id == "rec-acc"))
        await s.commit()


async def _state(maker):
    async with maker() as s:
        alt = await s.get(Allotment, "rec-alt")
        pnl = (await s.execute(select(RealizedPnl).where(RealizedPnl.allotment_id == "rec-alt"))).scalars().all()
        return alt.status, pnl


@pytest.mark.asyncio
async def test_order_status_is_unknown_without_broker_session(staged):
    res = await angel_service.get_order_status("SELL-REAL-1", client_id="RECCLIENT1")
    assert res["status"] == "UNKNOWN"


@pytest.mark.asyncio
async def test_no_pnl_booked_without_broker_session(staged):
    await scheduler.reconcile_listing_sells()
    status, pnl = await _state(staged)
    assert status == "STAGED" and pnl == []


@pytest.mark.asyncio
async def test_no_pnl_booked_for_complete_without_fill_price(staged):
    fake = {"status": "COMPLETE", "average_price": 0.0, "filled_shares": 0}
    with patch.object(angel_service, "get_order_status", new=AsyncMock(return_value=fake)):
        await scheduler.reconcile_listing_sells()
    status, pnl = await _state(staged)
    assert status == "STAGED" and pnl == []


@pytest.mark.asyncio
async def test_no_pnl_booked_for_simulated_status(staged):
    fake = {"status": "COMPLETE", "average_price": 150.0, "filled_shares": 100, "is_simulation": True}
    with patch.object(angel_service, "get_order_status", new=AsyncMock(return_value=fake)):
        await scheduler.reconcile_listing_sells()
    status, pnl = await _state(staged)
    assert status == "STAGED" and pnl == []


@pytest.mark.asyncio
async def test_partial_fill_is_not_booked_as_full_sale(staged):
    fake = {"status": "COMPLETE", "average_price": 150.0, "filled_shares": 40, "is_simulation": False}
    with patch.object(angel_service, "get_order_status", new=AsyncMock(return_value=fake)):
        await scheduler.reconcile_listing_sells()
    status, pnl = await _state(staged)
    assert status == "STAGED" and pnl == []


@pytest.mark.asyncio
async def test_full_real_fill_books_pnl_at_fill_price_not_limit(staged):
    fake = {"status": "COMPLETE", "average_price": 142.5, "filled_shares": 100, "is_simulation": False}
    with patch.object(angel_service, "get_order_status", new=AsyncMock(return_value=fake)):
        await scheduler.reconcile_listing_sells()
    status, pnl = await _state(staged)
    assert status == "SOLD"
    assert len(pnl) == 1 and pnl[0].exit_price == 142.5
