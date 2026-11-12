"""F09: stage-sell must say what actually happened and refuse unsafe states / prices."""
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import Allotment
from app.models.ipo import Ipo
from app.schemas.allotment import StageSellRequest
from app.services.allotment_service import allotment_service

PATH = "app.services.allotment_service.angel_service.stage_listing_sell_order"


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(FamilyAccount(id="st-acc", name="Stage", relation="Self", angel_client_id="STAGE1"))
        s.add(Ipo(id="st-ipo", symbol="STG", name="Stage Ltd", slug="stage", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(Allotment).where(Allotment.account_id == "st-acc"))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id == "st-acc"))
        await s.execute(delete(Ipo).where(Ipo.id == "st-ipo"))
        await s.commit()


async def _alt(db, status="ACTIVE", sell_order_id=None):
    db.add(Allotment(id=f"st-alt-{status}", account_id="st-acc", ipo_id="st-ipo", account_name="Stage",
                     angel_client_id="STAGE1", ipo_name="Stage Ltd", ipo_symbol="STG", allotted_shares=100,
                     issue_price=100.0, invested_amount=10000.0, status=status, sell_order_id=sell_order_id))
    await db.commit()
    return f"st-alt-{status}"


@pytest.mark.asyncio
async def test_broker_failure_is_reported_honestly(db):
    aid = await _alt(db)
    with patch(PATH, new=AsyncMock(return_value={"success": False, "status": "TOKEN_NOT_FOUND", "message": "x"})):
        res = await allotment_service.stage_sell_order(db, aid, StageSellRequest(limit_price=150.0))
    assert res["placed_with_broker"] is False
    assert "queued" in res["message"].lower()
    assert "staged at" not in res["message"].lower()
    alt = await db.get(Allotment, aid)
    assert alt.status == "ACTIVE" and alt.staged_sell_limit_price == 150.0 and alt.sell_order_id is None


@pytest.mark.asyncio
async def test_broker_success_marks_staged(db):
    aid = await _alt(db)
    with patch(PATH, new=AsyncMock(return_value={"success": True, "sell_order_id": "S-1"})):
        res = await allotment_service.stage_sell_order(db, aid, StageSellRequest(limit_price=150.0))
    assert res["placed_with_broker"] is True
    alt = await db.get(Allotment, aid)
    assert alt.status == "STAGED" and alt.sell_order_id == "S-1"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["STAGED", "SOLD", "SELL_SUBMITTED"])
async def test_cannot_restage_non_active_allotment(db, status):
    aid = await _alt(db, status, sell_order_id="S-0" if status == "STAGED" else None)
    broker = AsyncMock(return_value={"success": True, "sell_order_id": "S-2"})
    with patch(PATH, new=broker):
        with pytest.raises(ValueError):
            await allotment_service.stage_sell_order(db, aid, StageSellRequest(limit_price=150.0))
    broker.assert_not_awaited()


@pytest.mark.parametrize("price", [0, -5, -0.01])
def test_limit_price_must_be_positive(price):
    with pytest.raises(ValidationError):
        StageSellRequest(limit_price=price)
