"""Stored IPO statuses go stale when a source stops listing an IPO; the nightly job refreshes them from the dates."""
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.ipo import Ipo
from app.services.ipo_service import refresh_statuses

D = date.today()


def _ipo(symbol, status, open_off, close_off, **kw):
    return Ipo(id=f"id-{symbol}", symbol=symbol, name=f"{symbol} Ltd", slug=symbol.lower(), type="EQ", status=status,
               price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
               issue_open_date=None if open_off is None else D + timedelta(days=open_off),
               issue_close_date=None if close_off is None else D + timedelta(days=close_off), **kw)


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        await s.execute(delete(Ipo).where(Ipo.symbol.like("STS%")))
        await s.commit()


@pytest.mark.asyncio
async def test_stale_statuses_are_corrected_and_unknown_dates_are_left_alone(db):
    db.add_all([
        _ipo("STSOPEN", "open", -60, -55),          # closed long ago but still says open
        _ipo("STSUP", "upcoming", -10, -5),         # same, still says upcoming
        _ipo("STSSTART", "upcoming", -1, 2),        # opened since the last refresh
        _ipo("STSTODAY", "open", -2, 0),            # closes today
        _ipo("STSFINE", "open", -1, 3),             # already correct
        _ipo("STSNODATE", "upcoming", None, None),  # dates not announced: no basis to change
        _ipo("STSLISTED", "closed", -30, -25),
    ])
    await db.commit()
    changed = await refresh_statuses(db)
    got = {i.symbol: i.status for i in (await db.execute(select(Ipo).where(Ipo.symbol.like("STS%")))).scalars().all()}
    assert got == {"STSOPEN": "closed", "STSUP": "closed", "STSSTART": "open", "STSTODAY": "closing_today",
                   "STSFINE": "open", "STSNODATE": "upcoming", "STSLISTED": "closed"}
    assert changed >= 4


@pytest.mark.asyncio
async def test_a_second_refresh_changes_nothing(db):
    db.add(_ipo("STSTWICE", "open", -60, -55))
    await db.commit()
    await refresh_statuses(db)
    assert await refresh_statuses(db) == 0
    assert (await db.execute(select(Ipo).where(Ipo.symbol == "STSTWICE"))).scalar_one().status == "closed"
