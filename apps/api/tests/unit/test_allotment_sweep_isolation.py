"""F29: one failing order must not abort the sweep for the others."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import Allotment, AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.services.allotment_service import allotment_service
from app.services.order_service import order_service

ACCS = ["sw-acc-1", "sw-acc-2"]


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(Ipo(id="sw-ipo", symbol="SWEEP", name="Sweep Ltd", slug="sweep", type="EQ", status="closed",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  allotment_date=date.today() - timedelta(days=1),
                  listing_date=date.today() + timedelta(days=1)))
        for i, a in enumerate(ACCS):
            s.add(FamilyAccount(id=a, name=a, relation="Self", angel_client_id=f"SWC{i}",
                                available_liquid_balance=0.0, locked_asba_balance=10000.0))
        await s.flush()
        for i, a in enumerate(ACCS):
            s.add(IpoOrder(id=f"sw-ord-{i}", account_id=a, ipo_id="sw-ipo", account_name=a, ipo_name="Sweep Ltd",
                           lots=1, shares=100, bid_price=100.0, amount=10000.0, upi_vpa="a@upi",
                           status="SUBMITTED", placed_at=date.today()))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(Allotment).where(Allotment.account_id.in_(ACCS)))
        await s.execute(delete(AsbaLock).where(AsbaLock.account_id.in_(ACCS)))
        await s.execute(delete(IpoOrder).where(IpoOrder.account_id.in_(ACCS)))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id.in_(ACCS)))
        await s.execute(delete(Ipo).where(Ipo.id == "sw-ipo"))
        await s.commit()


@pytest.mark.asyncio
async def test_failure_on_first_order_does_not_stop_second(db):
    holdings = [{"tradingsymbol": "SWEEP-EQ", "totalqty": 100}]
    real = order_service.process_allotment_result
    calls = {"n": 0}

    async def flaky(*a, **k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("db hiccup")
        return await real(*a, **k)

    with patch("app.services.allotment_service.angel_service.get_all_holdings", new=AsyncMock(return_value=holdings)), \
         patch.object(order_service, "process_allotment_result", new=flaky):
        res = await allotment_service.auto_detect_allotments(db)

    assert calls["n"] == 2
    assert res["allotted"] == 1
    assert any("db hiccup" in d for d in res["details"])
