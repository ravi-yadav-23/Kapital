"""F05: SEBI allows one application per PAN per IPO - enforce it at order time, not only in the optimizer."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.schemas.order import OrderCreate
from app.services.order_service import order_service

OK = {"success": True, "broker_order_id": "B1", "status": "SUBMITTED", "mandate_status": "REQUESTED"}
IDS = ["pan-a", "pan-b", "pan-c", "pan-d"]


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        pans = {"pan-a": "SAMEP1234P", "pan-b": "samep1234p", "pan-c": "OTHER1234O", "pan-d": None}
        for i in IDS:
            s.add(FamilyAccount(id=i, name=i, relation="Self", angel_client_id=f"CL-{i}", pan=pans[i],
                                total_demat_balance=500000.0, available_liquid_balance=500000.0))
        s.add(Ipo(id="pan-ipo", symbol="PANI", name="Pan Ltd", slug="pan-ltd", type="EQ", status="open",
                  price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                  issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2),
                  listing_date=date.today() + timedelta(days=6)))
        await s.commit()
        yield s
        await s.rollback()
        await s.execute(delete(AsbaLock).where(AsbaLock.account_id.in_(IDS)))
        await s.execute(delete(IpoOrder).where(IpoOrder.account_id.in_(IDS)))
        await s.execute(delete(FamilyAccount).where(FamilyAccount.id.in_(IDS)))
        await s.execute(delete(Ipo).where(Ipo.id == "pan-ipo"))
        await s.commit()


def _req(acc):
    return OrderCreate(account_id=acc, ipo_id="pan-ipo", lots=1, upi_vpa="a@upi", category="RETAIL")


@pytest.mark.asyncio
async def test_second_account_with_same_pan_is_rejected_case_insensitively(db):
    with patch("app.services.order_service.angel_service.apply_ipo", new=AsyncMock(return_value=OK)) as ap:
        await order_service.create_order(db, _req("pan-a"))
        with pytest.raises(ValueError, match="PAN"):
            await order_service.create_order(db, _req("pan-b"))
        assert ap.await_count == 1  # broker never called for the duplicate


@pytest.mark.asyncio
async def test_different_pans_and_missing_pans_are_not_blocked(db):
    with patch("app.services.order_service.angel_service.apply_ipo", new=AsyncMock(return_value=OK)):
        await order_service.create_order(db, _req("pan-a"))
        await order_service.create_order(db, _req("pan-c"))
        await order_service.create_order(db, _req("pan-d"))
