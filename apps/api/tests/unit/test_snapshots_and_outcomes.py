"""M3: daily GMP / subscription snapshots and listing outcomes are captured append-only by the source runner."""
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.ipo import Ipo
from app.models.snapshots import GmpSnapshot, SubscriptionSnapshot, IpoOutcome
from app.models.source_health import SourceHealth
from app.sources.base import Source, SourceResult
from app.sources.runner import run_sources


class Fake(Source):
    daily_request_budget = None

    def __init__(self, name, records):
        self.name = name
        self._records = records

    def enabled(self):
        return True

    async def fetch(self, *, requests_allowed=None):
        return SourceResult(records=self._records, requests_used=1)


def _rec(symbol, **kw):
    base = dict(symbol=symbol, name=f"{symbol} Ltd", slug=symbol.lower(), type="EQ", status="open",
                price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=date.today().isoformat(), issue_close_date=date.today().isoformat())
    base.update(kw)
    return base


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        for m in (GmpSnapshot, SubscriptionSnapshot, IpoOutcome):
            await s.execute(delete(m))
        await s.execute(delete(SourceHealth).where(SourceHealth.source.like("snap_%")))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("SNP%")))
        await s.commit()


async def _count(db, model):
    return len((await db.execute(select(model))).scalars().all())


@pytest.mark.asyncio
async def test_gmp_and_subscription_are_snapshotted(db):
    await run_sources(db, [Fake("snap_a", [_rec("SNP1", gmp_percent=25.0, gmp_rupees=25.0,
                                                subscription_total=12.5, subscription_qib=30.0)])])
    g = (await db.execute(select(GmpSnapshot))).scalars().all()
    s = (await db.execute(select(SubscriptionSnapshot))).scalars().all()
    assert len(g) == 1 and g[0].gmp_percent == 25.0 and g[0].source == "snap_a" and g[0].snapshot_date == date.today()
    assert len(s) == 1 and s[0].total == 12.5 and s[0].qib == 30.0


@pytest.mark.asyncio
async def test_same_day_rerun_updates_instead_of_duplicating(db):
    await run_sources(db, [Fake("snap_a", [_rec("SNP2", gmp_percent=10.0)])])
    await run_sources(db, [Fake("snap_a", [_rec("SNP2", gmp_percent=14.0)])])
    rows = (await db.execute(select(GmpSnapshot))).scalars().all()
    assert len(rows) == 1 and rows[0].gmp_percent == 14.0
    # a different source on the same day is a separate observation
    await run_sources(db, [Fake("snap_b", [_rec("SNP2", gmp_percent=12.0)])])
    assert await _count(db, GmpSnapshot) == 2


@pytest.mark.asyncio
async def test_no_quote_means_no_snapshot(db):
    await run_sources(db, [Fake("snap_a", [_rec("SNP3")])])
    assert await _count(db, GmpSnapshot) == 0
    assert await _count(db, SubscriptionSnapshot) == 0


@pytest.mark.asyncio
async def test_listing_outcome_recorded_once_with_final_signals(db):
    await run_sources(db, [Fake("snap_a", [_rec("SNP4", gmp_percent=30.0, subscription_total=50.0)])])
    closed = _rec("SNP4", status="closed", listing_price=140.0, listing_gain_percent=40.0,
                  listing_date=date.today().isoformat())
    await run_sources(db, [Fake("snap_a", [closed])])
    await run_sources(db, [Fake("snap_a", [closed])])  # re-run is idempotent
    out = (await db.execute(select(IpoOutcome))).scalars().all()
    assert len(out) == 1
    o = out[0]
    assert o.listing_price == 140.0 and o.listing_gain_percent == 40.0 and o.issue_price == 100.0
    assert o.last_gmp_percent == 30.0 and o.last_subscription_total == 50.0
    assert o.source == "snap_a"


@pytest.mark.asyncio
async def test_outcome_not_created_without_listing_data(db):
    await run_sources(db, [Fake("snap_a", [_rec("SNP5", status="closed")])])
    assert await _count(db, IpoOutcome) == 0
