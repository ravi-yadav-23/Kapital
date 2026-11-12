"""
Route x identity regression matrix.

Discovers routes by introspecting app.routes:
- every route depending on `require_admin` must reject none / invalid / 2FA-pending
  tokens (401) and guest tokens (403);
- every route depending on `get_viewer` must never leak seeded "real" data
  (PAN, broker client id, UPI VPA, account name) to non-admin callers.
"""
import re
from datetime import date, timedelta

import pytest
import pytest_asyncio
from fastapi.routing import APIRoute
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import app
from app.middleware.auth import create_access_token, create_temp_2fa_token, require_admin, get_viewer
from app.models.account import FamilyAccount
from app.models.allotment import Allotment, AsbaLock
from app.models.ipo import Ipo
from app.models.order import IpoOrder
from app.models.setting import SystemSetting

MARKERS = {
    "PAN": "QWERT9876Z",
    "CLIENT": "ZZREAL9001",
    "UPI": "priya.real@okhdfcbank",
    "NAME": "Priya Realname",
}
IDS = {"acc": "matrix-acc-1", "ipo": "matrix-ipo-1", "ord": "matrix-ord-1",
       "alt": "matrix-alt-1", "lock": "matrix-lock-1", "set": "matrix-set-1"}


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    """Keep the matrix fast and offline: the rate limiter must not try to reach Redis."""
    async def _none():
        return None
    monkeypatch.setattr("app.middleware.rate_limit.get_redis_pool", _none)


def _dep_calls(dependant, acc=None):
    acc = acc if acc is not None else set()
    for d in dependant.dependencies:
        acc.add(d.call)
        _dep_calls(d, acc)
    return acc


def _routes(dep):
    seen = {}
    for r in app.routes:
        if not isinstance(r, APIRoute) or dep not in _dep_calls(r.dependant):
            continue
        path = r.path[4:] if r.path.startswith("/api/") else r.path
        for m in r.methods - {"HEAD", "OPTIONS"}:
            seen.setdefault((m, path), r)
    return sorted(seen)


SUBS = {"{ipo_id}": IDS["ipo"], "{order_id}": IDS["ord"], "{account_id}": IDS["acc"],
        "{allotment_id}": IDS["alt"], "{task_id}": "plan-x"}


def _fill(p):
    for k, v in SUBS.items():
        p = p.replace(k, v)
    return re.sub(r"\{[^}]+\}", "x", p)


@pytest_asyncio.fixture
async def seeded(test_engine):
    maker = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        s.add(FamilyAccount(id=IDS["acc"], name=MARKERS["NAME"], relation="Self",
                            angel_client_id=MARKERS["CLIENT"], pan=MARKERS["PAN"],
                            total_demat_balance=777777.0, available_liquid_balance=555555.0,
                            locked_asba_balance=1.0, is_active=True))
        s.add(Ipo(id=IDS["ipo"], symbol="MTRXCO", name="Matrix Co Ltd", slug="matrix-co", type="EQ",
                  status="open", price_band_min=100.0, price_band_max=110.0, lot_size=100,
                  min_investment=11000.0, issue_open_date=date.today(),
                  issue_close_date=date.today() + timedelta(days=2),
                  listing_date=date.today() + timedelta(days=6), score=70))
        await s.flush()
        s.add(IpoOrder(id=IDS["ord"], account_id=IDS["acc"], ipo_id=IDS["ipo"],
                       account_name=MARKERS["NAME"], ipo_name="Matrix Co Ltd", lots=1, shares=100,
                       bid_price=110.0, amount=11000.0, upi_vpa=MARKERS["UPI"], status="CONFIRMED"))
        s.add(Allotment(id=IDS["alt"], account_id=IDS["acc"], ipo_id=IDS["ipo"],
                        account_name=MARKERS["NAME"], angel_client_id=MARKERS["CLIENT"],
                        ipo_name="Matrix Co Ltd", ipo_symbol="MTRXCO", allotted_shares=100,
                        issue_price=110.0, invested_amount=11000.0, status="ACTIVE"))
        s.add(AsbaLock(id=IDS["lock"], account_id=IDS["acc"], ipo_id=IDS["ipo"],
                       account_name=MARKERS["NAME"], ipo_name="Matrix Co Ltd", amount=11000.0,
                       lock_date=date.today(), release_date=date.today() + timedelta(days=5)))
        s.add(SystemSetting(id=IDS["set"], key="app_preferences",
                            value={"default_upi_vpa": MARKERS["UPI"], "groq_api_key": ""}))
        await s.commit()
    yield
    async with maker() as s:
        for model in (AsbaLock, Allotment, IpoOrder, SystemSetting, Ipo, FamilyAccount):
            await s.execute(delete(model).where(model.id.in_(list(IDS.values()))))
        await s.commit()


def _identities():
    return {
        "none": {},
        "invalid": {"Authorization": "Bearer not.a.jwt"},
        "pending2fa": {"Authorization": "Bearer " + create_temp_2fa_token({"email": "a@b.c"})},
        "guest": {"Authorization": "Bearer " + create_access_token(
            {"sub": "g", "role": "GUEST", "is_guest": True})},
    }


def test_matrix_discovers_routes():
    assert len(_routes(require_admin)) >= 14
    assert len(_routes(get_viewer)) >= 9


@pytest.mark.asyncio
async def test_admin_routes_reject_non_admins(seeded):
    failures = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        for method, path in _routes(require_admin):
            for name, headers in _identities().items():
                body = {} if method in ("POST", "PUT", "PATCH") else None
                resp = await c.request(method, _fill(path), headers=headers, json=body)
                want = 403 if name == "guest" else 401
                if resp.status_code != want:
                    failures.append(f"{method} {path} as {name}: {resp.status_code} (want {want})")
    assert not failures, "\n".join(failures)


@pytest.mark.asyncio
async def test_viewer_routes_never_leak_real_data_to_non_admins(seeded):
    leaks = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        for method, path in _routes(get_viewer):
            for name, headers in _identities().items():
                body = {} if method in ("POST", "PUT", "PATCH") else None
                resp = await c.request(method, _fill(path), headers=headers, json=body)
                assert resp.status_code < 500, f"{method} {path} as {name}: {resp.status_code}"
                for label, value in MARKERS.items():
                    if value in resp.text:
                        leaks.append(f"{method} {path} as {name} leaked {label}")
    assert not leaks, "\n".join(leaks)


@pytest.mark.asyncio
async def test_admin_never_receives_raw_pan(seeded):
    admin = {"Authorization": "Bearer " + create_access_token(
        {"sub": "admin-1", "role": "ADMIN", "is_guest": False})}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        for path in ("/api/funds/accounts", "/api/orders", "/api/allotments", "/api/funds/locks"):
            resp = await c.get(path, headers=admin)
            assert resp.status_code == 200
            assert MARKERS["PAN"] not in resp.text, path
