"""F04: allotment results may only be applied to live orders, and only once."""
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import Allotment, AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.services.order_service import order_service


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(FamilyAccount(id="g-acc", name="Guard", relation="Self", angel_client_id="GUARD1",
                            total_demat_balance=100000.0, available_liquid_balance=90000.0,
                            locked_asba_balance=10000.0))
        s.add(Ipo(id="g-ipo", symbol="GRD", name="Guard Ltd", slug="guard", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  listing_date=date.today() + timedelta(days=5)))
        await s.commit()
        yield s
        await s.rollback()
        for m, col in ((Allotment, Allotment.account_id), (AsbaLock, AsbaLock.account_id), (IpoOrder, IpoOrder.account_id)):
            await s.execute(delete(m).where(col == "g-acc"))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id == "g-acc"))
        await s.execute(delete(Ipo).where(Ipo.id == "g-ipo"))
        await s.commit()


async def _order(db, status):
    db.add(IpoOrder(id=f"g-ord-{status}", account_id="g-acc", ipo_id="g-ipo", account_name="Guard",
                    ipo_name="Guard Ltd", lots=1, shares=100, bid_price=100.0, amount=10000.0,
                    upi_vpa="a@upi", status=status))
    await db.commit()
    return f"g-ord-{status}"


async def _allotments(db):
    return (await db.execute(select(Allotment).where(Allotment.account_id == "g-acc"))).scalars().all()


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["CANCELLED", "FAILED", "REJECTED"])
async def test_allotted_rejected_for_dead_orders(db, status):
    oid = await _order(db, status)
    with pytest.raises(ValueError):
        await order_service.process_allotment_result(db, oid, "ALLOTTED", 100)
    assert await _allotments(db) == []


@pytest.mark.asyncio
async def test_allotted_twice_is_idempotent(db):
    oid = await _order(db, "SUBMITTED")
    first = await order_service.process_allotment_result(db, oid, "ALLOTTED", 100)
    assert first["status"] == "ALLOTTED"
    acc = await db.get(FamilyAccount, "g-acc")
    locked_after_first = acc.locked_asba_balance
    second = await order_service.process_allotment_result(db, oid, "ALLOTTED", 100)
    assert second["success"] is True and second.get("already_processed") is True
    await db.refresh(acc)
    assert acc.locked_asba_balance == locked_after_first
    assert len(await _allotments(db)) == 1


@pytest.mark.asyncio
async def test_not_allotted_cannot_override_allotted(db):
    oid = await _order(db, "SUBMITTED")
    await order_service.process_allotment_result(db, oid, "ALLOTTED", 100)
    with pytest.raises(ValueError):
        await order_service.process_allotment_result(db, oid, "NOT_ALLOTTED")
    order = await db.get(IpoOrder, oid)
    assert order.status == "ALLOTTED"


@pytest.mark.asyncio
async def test_not_allotted_twice_does_not_double_release(db):
    oid = await _order(db, "SUBMITTED")
    await order_service.process_allotment_result(db, oid, "NOT_ALLOTTED")
    acc = await db.get(FamilyAccount, "g-acc")
    avail = acc.available_liquid_balance
    again = await order_service.process_allotment_result(db, oid, "NOT_ALLOTTED")
    assert again.get("already_processed") is True
    await db.refresh(acc)
    assert acc.available_liquid_balance == avail
