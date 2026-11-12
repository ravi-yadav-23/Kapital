"""F03: a broker/RMS failure must never overwrite stored balances with zero."""
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import delete

from app.models.account import FamilyAccount
from app.services.account_service import account_service
from app.services.angel_service import angel_service


@pytest.fixture
def no_sessions(monkeypatch):
    monkeypatch.setattr(angel_service, "sessions", {})


@pytest.mark.asyncio
async def test_get_rms_limits_returns_none_without_session(no_sessions):
    assert await angel_service.get_rms_limits("NOSESSION1") is None


@pytest.mark.asyncio
async def test_get_rms_limits_returns_none_on_http_error(monkeypatch):
    monkeypatch.setattr(angel_service, "sessions", {"C1": {"jwtToken": "t", "api_key": "k"}})

    class Boom:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): raise RuntimeError("network down")
        async def __aexit__(self, *a): return False

    with patch("app.services.angel_service.httpx.AsyncClient", Boom):
        assert await angel_service.get_rms_limits("C1") is None


@pytest.mark.asyncio
async def test_sync_live_balance_keeps_balances_when_broker_fails(db_session):
    db = db_session
    db.add(FamilyAccount(id="rms-acc", name="Rms Probe", relation="Self", angel_client_id="RMSPROBE1",
                         total_demat_balance=500000.0, available_liquid_balance=400000.0,
                         locked_asba_balance=0.0))
    await db.commit()
    try:
        with patch("app.services.angel_service.angel_service.get_rms_limits",
                   new=AsyncMock(return_value=None)):
            res = await account_service.sync_live_balance(db, "RMSPROBE1")
        assert res is not None
        assert res.available_balance == 400000.0
        assert res.total_balance == 500000.0
    finally:
        await db.rollback()
        await db.execute(delete(FamilyAccount).where(FamilyAccount.id == "rms-acc"))
        await db.commit()


@pytest.mark.asyncio
async def test_sync_live_balance_error_path_does_not_crash(db_session):
    db = db_session
    db.add(FamilyAccount(id="rms-acc2", name="Rms Probe2", relation="Self", angel_client_id="RMSPROBE2",
                         total_demat_balance=10.0, available_liquid_balance=5.0, locked_asba_balance=0.0))
    await db.commit()
    try:
        with patch("app.services.angel_service.angel_service.get_rms_limits",
                   new=AsyncMock(side_effect=RuntimeError("boom"))):
            res = await account_service.sync_live_balance(db, "RMSPROBE2")
        assert res.available_balance == 5.0
    finally:
        await db.rollback()
        await db.execute(delete(FamilyAccount).where(FamilyAccount.id == "rms-acc2"))
        await db.commit()
