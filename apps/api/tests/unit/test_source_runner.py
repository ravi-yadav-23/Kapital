"""M2: the source runner isolates failures, tracks health and enforces request budgets."""
from datetime import date, datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.ipo import Ipo
from app.models.source_health import SourceHealth
from app.sources.base import Source, SourceResult
from app.sources.runner import run_sources


class FakeSource(Source):
    def __init__(self, name, records=None, error=None, enabled=True, budget=None, used=1, raises=None, warnings=None):
        self.name = name
        self._records, self._error, self._enabled = records or [], error, enabled
        self.daily_request_budget = budget
        self._used, self._raises, self._warnings = used, raises, warnings or []
        self.calls = []

    def enabled(self):
        return self._enabled

    async def fetch(self, *, requests_allowed=None):
        self.calls.append(requests_allowed)
        if self._raises:
            raise self._raises
        used = self._used if requests_allowed is None else min(self._used, requests_allowed)
        return SourceResult(records=self._records, error=self._error, requests_used=used, warnings=self._warnings)


def _rec(symbol, name=None, **kw):
    base = dict(symbol=symbol, name=name or f"{symbol} Ltd", slug=symbol.lower(), type="EQ", status="open",
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
        await s.execute(delete(SourceHealth).where(SourceHealth.source.like("t_%")))
        await s.execute(delete(Ipo).where(Ipo.symbol.like("RUN%")))
        await s.commit()


async def _health(db, name):
    return (await db.execute(select(SourceHealth).where(SourceHealth.source == name))).scalar_one_or_none()


@pytest.mark.asyncio
async def test_a_crashing_source_does_not_stop_the_others(db):
    bad = FakeSource("t_bad", raises=RuntimeError("layout changed"))
    good = FakeSource("t_good", records=[_rec("RUNA")])
    reports = await run_sources(db, [bad, good])
    by = {r.name: r for r in reports}
    assert by["t_bad"].status == "failed" and "layout changed" in by["t_bad"].error
    assert by["t_good"].status == "ok" and by["t_good"].upserted == 1
    assert (await db.execute(select(Ipo).where(Ipo.symbol == "RUNA"))).scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_health_is_recorded_and_failures_accumulate_then_reset(db):
    flaky = FakeSource("t_flaky", error="HTTP 403")
    await run_sources(db, [flaky])
    await run_sources(db, [flaky])
    h = await _health(db, "t_flaky")
    assert h.consecutive_failures == 2 and "403" in h.last_error and h.last_success_at is None

    ok = FakeSource("t_flaky", records=[_rec("RUNB")])
    await run_sources(db, [ok])
    h = await _health(db, "t_flaky")
    assert h.consecutive_failures == 0 and h.last_success_at is not None and h.last_record_count == 1


@pytest.mark.asyncio
async def test_zero_records_from_a_scraper_is_a_warning_not_silent_success(db):
    empty = FakeSource("t_empty", records=[])
    (rep,) = await run_sources(db, [empty])
    assert rep.status == "warning"
    assert "0 records" in (await _health(db, "t_empty")).last_error


@pytest.mark.asyncio
async def test_api_sources_may_legitimately_return_nothing(db):
    api = FakeSource("t_api", records=[])
    api.empty_is_normal = True
    (rep,) = await run_sources(db, [api])
    assert rep.status == "ok"


@pytest.mark.asyncio
async def test_disabled_sources_are_not_called(db):
    off = FakeSource("t_off", records=[_rec("RUNC")], enabled=False)
    (rep,) = await run_sources(db, [off])
    assert rep.status == "disabled" and off.calls == []


@pytest.mark.asyncio
async def test_daily_request_budget_is_enforced_and_tracked(db):
    src = FakeSource("t_budget", records=[_rec("RUND")], budget=3, used=2)
    r1 = (await run_sources(db, [src]))[0]
    assert r1.status == "ok" and src.calls == [3]  # allowed all 3, used 2
    r2 = (await run_sources(db, [src]))[0]
    assert src.calls == [3, 1]  # only 1 left today
    r3 = (await run_sources(db, [src]))[0]
    assert r3.status == "skipped_budget" and len(src.calls) == 2  # not called again
    h = await _health(db, "t_budget")
    assert h.requests_today == 3 and h.budget_date == date.today()


@pytest.mark.asyncio
async def test_a_bad_record_is_skipped_but_good_ones_are_kept(db):
    src = FakeSource("t_mixed", records=[{"symbol": "RUNE"}, _rec("RUNF")])  # first lacks required fields
    (rep,) = await run_sources(db, [src])
    assert rep.upserted == 1 and rep.record_errors == 1
    assert (await db.execute(select(Ipo).where(Ipo.symbol == "RUNF"))).scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_implausible_values_are_dropped_not_stored(db):
    src = FakeSource("t_sane", records=[_rec("RUNG", gmp_percent=950.0, subscription_total=-3.0)])
    (rep,) = await run_sources(db, [src])
    assert rep.upserted == 1
    ipo = (await db.execute(select(Ipo).where(Ipo.symbol == "RUNG"))).scalar_one()
    assert not ipo.gmp_percent, "a GMP of +950% is not plausible and must not be stored"
    assert not ipo.subscription_total
    assert "implausible" in (await _health(db, "t_sane")).last_error.lower()


@pytest.mark.asyncio
async def test_a_record_without_a_name_is_rejected(db):
    src = FakeSource("t_noname", records=[{**_rec("RUNH"), "name": ""}])
    (rep,) = await run_sources(db, [src])
    assert rep.upserted == 0 and rep.record_errors == 1 and rep.status == "failed"
