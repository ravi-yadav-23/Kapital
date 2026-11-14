"""M1: explainable score changes (history) and one effective-rating rule (stubs are not audits)."""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.ipo import Ipo
from app.models.report import AiReport
from app.models.score_history import ScoreHistory
from app.services.ipo_service import effective_rating, ipo_service
from app.services.score_history import record_score
from app.utils.scoring import recommendation_for


def _ipo(**kw):
    base = dict(gmp_percent=20.0, subscription_qib=1.0, subscription_total=3.0)
    base.update(kw)
    return SimpleNamespace(**base)


def test_an_audited_report_no_longer_decides_the_score():
    """Decision: one engine score everywhere. The old report keeps its factor breakdown (third value) only."""
    rep = SimpleNamespace(is_audited=True, overall_score=71, recommendation="MODERATE_APPLY")
    score, rec, has_report = effective_rating(_ipo(gmp_percent=90.0), rep)
    assert has_report is True
    assert score != 71 and score == effective_rating(_ipo(gmp_percent=90.0), None)[0]   # same with or without the report
    assert rec == recommendation_for(score)


def test_stub_report_and_no_report_give_the_same_engine_score():
    stub = SimpleNamespace(is_audited=False, overall_score=33, recommendation="PENDING")
    score, rec, has_report = effective_rating(_ipo(), stub)
    assert (score, has_report) == (51, False)           # engine: GMP 20% + demand 3x (QIB 1x), no documents yet
    assert rec == "WATCH" == recommendation_for(51)
    assert effective_rating(_ipo(), None)[0] == 51


def test_document_facts_move_the_score_and_a_verified_critical_flag_vetoes():
    good = dict(net_profit_cr=80.0, revenue_growth_pct=30.0, debt_to_equity=0.4, promoter_holding_post_pct=70.0)
    base = effective_rating(_ipo(name="Plain Ltd"), None)[0]
    assert effective_rating(_ipo(name="Plain Ltd"), None, good)[0] > base
    vetoed = dict(good, regulatory_action_against_promoter=True,
                  regulatory_action_evidence="SEBI passed an order against our Promoter imposing a penalty.")
    assert effective_rating(_ipo(name="Plain Ltd"), None, vetoed)[0] <= 35


def test_no_data_no_report_is_no_score():
    assert effective_rating(_ipo(gmp_percent=0.0, subscription_qib=0.0, subscription_total=0.0), None) == (None, "PENDING", False)


@pytest_asyncio.fixture
async def db(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
        await s.rollback()
        await s.execute(delete(ScoreHistory).where(ScoreHistory.ipo_id.like("sh-%")))
        await s.execute(delete(Ipo).where(Ipo.id.like("sh-%")))
        await s.commit()


async def _rows(db, ipo_id):
    res = await db.execute(select(ScoreHistory).where(ScoreHistory.ipo_id == ipo_id).order_by(ScoreHistory.created_at, ScoreHistory.id))
    return res.scalars().all()


@pytest.mark.asyncio
async def test_history_records_only_real_changes_with_a_reason(db):
    await record_score(db, "sh-1", "momentum", 56, "WATCH", "GMP 20% , total 3x", {"gmp": 20})
    await record_score(db, "sh-1", "momentum", 56, "WATCH", "same", {})
    await record_score(db, "sh-1", "momentum", 70, "MODERATE_APPLY", "GMP rose to 35%", {"gmp": 35})
    rows = await _rows(db, "sh-1")
    assert [r.value for r in rows] == [56, 70]
    assert rows[1].reason == "GMP rose to 35%"


@pytest.mark.asyncio
async def test_history_does_not_start_with_an_empty_score(db):
    await record_score(db, "sh-2", "momentum", None, "PENDING", "no data", {})
    assert await _rows(db, "sh-2") == []
    await record_score(db, "sh-2", "momentum", 40, "AVOID", "x", {})
    await record_score(db, "sh-2", "momentum", None, "PENDING", "data disappeared", {})
    assert [r.value for r in await _rows(db, "sh-2")] == [40, None]


@pytest.mark.asyncio
async def test_sync_updates_stored_score_and_writes_history(db):
    base = dict(symbol="SHA", name="History Alpha Ltd", slug="history-alpha", type="EQ", status="open",
                price_band_min=100.0, price_band_max=100.0, lot_size=100, min_investment=10000.0,
                issue_open_date=date.today(), issue_close_date=date.today() + timedelta(days=2),
                listing_date=date.today() + timedelta(days=6))
    db.add(Ipo(id="sh-3", gmp_percent=10.0, subscription_total=0.0, score=99, **base))
    await db.commit()
    ipo = (await db.execute(select(Ipo).where(Ipo.id == "sh-3"))).scalar_one()
    from app.services.ipo_service import refresh_stored_score
    await refresh_stored_score(db, ipo)
    await db.commit()
    assert ipo.score == 46  # stale 99 replaced by the single formula (GMP 10% only)
    rows = await _rows(db, "sh-3")
    assert len(rows) == 1 and "GMP" in rows[0].reason
