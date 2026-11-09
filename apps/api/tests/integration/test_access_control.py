"""
test_access_control.py — Data Isolation Regression Tests
=========================================================
Regression coverage for the broken-access-control finding:

Previously several read routes used `get_current_user_optional` and branched on
`if user and user.get("is_guest")`. Because the dependency returns None for a
MISSING or INVALID token, the falsy `user` fell straight through to the real
database - so an anonymous caller (or anyone with a garbage token) received the
real family account names, client IDs and balances.

Every route listed below now uses the single `get_viewer()` dependency, which
returns ADMIN only for a valid non-guest ADMIN token and the demo viewer for
everyone else.
"""
import pytest
from httpx import AsyncClient

from app.middleware.auth import create_access_token

# Values seeded by the `seed_data` fixture (tests/conftest.py).
REAL_NAME = "Ravi Kumar"
REAL_CLIENT_ID = "R123456"
REAL_BALANCE = 1500000.0
REAL_AVAILABLE = 1200000.0
REAL_LOCKED = 300000.0
REAL_PAN = "ABCDE1234F"


def _admin_headers() -> dict:
    token = create_access_token({"sub": "admin-1", "role": "ADMIN", "email": "admin@kapitl.local"})
    return {"Authorization": f"Bearer {token}"}


def _guest_headers() -> dict:
    token = create_access_token({
        "sub": "guest-preview",
        "role": "GUEST",
        "is_guest": True,
        "email": "guest@kapitl.local",
    })
    return {"Authorization": f"Bearer {token}"}


def _garbage_headers() -> dict:
    return {"Authorization": "Bearer not-a-real-token.at.all"}


READ_ROUTES = [
    "/api/funds/summary",
    "/api/funds/accounts",
    "/api/funds/locks",
    "/api/funds/pnl-summary",
    "/api/orders",
    "/api/allotments",
    "/api/reports/pnl/summary",
    "/api/settings",
]


def _assert_no_real_data(payload, extra_names=()) -> None:
    """Assert that a response payload contains none of the seeded real values."""
    blob = repr(payload)
    for secret in (REAL_NAME, REAL_CLIENT_ID, REAL_PAN, *extra_names):
        assert secret not in blob, f"Real data leaked to a non-admin caller: {secret!r}"


# ── Anonymous / invalid-token / guest callers must only see demo data ─────────

@pytest.mark.parametrize("route", READ_ROUTES)
@pytest.mark.asyncio
async def test_no_token_never_sees_seeded_real_data(client: AsyncClient, seed_data, route):
    res = await client.get(route)
    assert res.status_code == 200, f"{route} returned {res.status_code}"
    _assert_no_real_data(res.json())


@pytest.mark.parametrize("route", READ_ROUTES)
@pytest.mark.asyncio
async def test_garbage_token_never_sees_seeded_real_data(client: AsyncClient, seed_data, route):
    res = await client.get(route, headers=_garbage_headers())
    assert res.status_code == 200, f"{route} returned {res.status_code}"
    _assert_no_real_data(res.json())


@pytest.mark.parametrize("route", READ_ROUTES)
@pytest.mark.asyncio
async def test_guest_token_never_sees_seeded_real_data(client: AsyncClient, seed_data, route):
    res = await client.get(route, headers=_guest_headers())
    assert res.status_code == 200, f"{route} returned {res.status_code}"
    _assert_no_real_data(res.json())


# ── Admin callers do get the real data ───────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_sees_real_accounts(client: AsyncClient, seed_data):
    res = await client.get("/api/funds/accounts", headers=_admin_headers())
    assert res.status_code == 200
    data = res.json()
    assert data[0]["name"] == REAL_NAME
    assert data[0]["angel_client_id"] == REAL_CLIENT_ID
    assert data[0]["total_balance"] == REAL_BALANCE
    assert data[0]["available_balance"] == REAL_AVAILABLE
    assert data[0]["locked_balance"] == REAL_LOCKED


@pytest.mark.asyncio
async def test_admin_sees_real_fund_summary(client: AsyncClient, seed_data):
    res = await client.get("/api/funds/summary", headers=_admin_headers())
    assert res.status_code == 200
    data = res.json()
    assert data["total_family_balance"] == REAL_BALANCE
    assert data["total_available"] == REAL_AVAILABLE
    assert data["total_locked_asba"] == REAL_LOCKED
    assert data["accounts_total"] == 1


@pytest.mark.asyncio
async def test_admin_summary_response_is_not_publicly_cacheable(client: AsyncClient, seed_data):
    """Real balances must never be served from a shared/proxy cache."""
    res = await client.get("/api/funds/summary", headers=_admin_headers())
    assert res.status_code == 200
    cache_control = res.headers.get("cache-control", "")
    assert "public" not in cache_control.lower()
    assert "no-store" in cache_control.lower()


@pytest.mark.asyncio
async def test_optimizer_returns_demo_plan_for_anonymous_callers(client: AsyncClient, seed_data):
    """The optimizer must never build a plan from real accounts for a non-admin."""
    res = await client.post("/api/funds/optimize")
    assert res.status_code == 200
    plan = res.json()
    assert plan.get("is_demo") is True
    _assert_no_real_data(plan)


# ── PAN is never returned in clear text ───────────────────────────────────────

@pytest.mark.asyncio
async def test_pan_is_masked_in_account_response(client: AsyncClient, seed_data, db_session):
    """Even an ADMIN must not receive the PAN in clear text."""
    from app.models.account import FamilyAccount
    from sqlalchemy import select

    # Give the seeded account a real PAN.
    async with db_session.begin_nested():
        result = await db_session.execute(
            select(FamilyAccount).where(FamilyAccount.id == "acc-test-1")
        )
        acc = result.scalar_one()
        acc.pan = REAL_PAN
        await db_session.flush()

    res = await client.get("/api/funds/accounts", headers=_admin_headers())
    assert res.status_code == 200
    body = res.text
    assert REAL_PAN not in body, "The raw PAN must never be returned over the API"
    assert REAL_CLIENT_ID in body

    pan_values = [a.get("pan") for a in res.json()]
    assert all(p is None or REAL_PAN not in p for p in pan_values)


def test_account_response_schema_masks_pan():
    """AccountResponse itself must mask a PAN, whatever the caller passes in."""
    from app.schemas.account import AccountResponse

    resp = AccountResponse(
        id="acc-1",
        name="Test",
        relation="Self",
        angel_client_id="C123",
        pan=REAL_PAN,
    )
    assert resp.pan != REAL_PAN
    assert REAL_PAN not in resp.pan


# ── Mutating account routes require ADMIN ────────────────────────────────────

@pytest.mark.asyncio
async def test_update_account_requires_admin(client: AsyncClient, seed_data):
    """PUT /funds/accounts/{id} must reject anonymous, garbage-token and guest callers."""
    body = {"available_balance": 999.0}

    res_none = await client.put("/api/funds/accounts/acc-test-1", json=body)
    assert res_none.status_code in (401, 403), f"no token -> {res_none.status_code}"

    res_garbage = await client.put("/api/funds/accounts/acc-test-1", json=body, headers=_garbage_headers())
    assert res_garbage.status_code in (401, 403), f"garbage token -> {res_garbage.status_code}"

    res_guest = await client.put("/api/funds/accounts/acc-test-1", json=body, headers=_guest_headers())
    assert res_guest.status_code in (401, 403), f"guest token -> {res_guest.status_code}"


@pytest.mark.asyncio
async def test_update_account_allows_admin(client: AsyncClient, seed_data):
    res = await client.put(
        "/api/funds/accounts/acc-test-1",
        json={"available_balance": 1234.0},
        headers=_admin_headers(),
    )
    assert res.status_code == 200
    assert res.json()["available_balance"] == 1234.0


# ── The dependency contract itself ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_viewer_returns_demo_viewer_for_anonymous():
    from app.middleware.auth import get_viewer

    viewer = await get_viewer(credentials=None)
    assert viewer is not None
    assert viewer["is_guest"] is True
    assert viewer["role"] == "GUEST"


@pytest.mark.asyncio
async def test_get_viewer_returns_demo_viewer_for_invalid_token():
    from fastapi.security import HTTPAuthorizationCredentials

    from app.middleware.auth import get_viewer

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="garbage.token.value")
    viewer = await get_viewer(credentials=creds)
    assert viewer is not None
    assert viewer["is_guest"] is True
    assert viewer["role"] == "GUEST"


@pytest.mark.asyncio
async def test_get_viewer_returns_admin_for_valid_admin_token():
    from fastapi.security import HTTPAuthorizationCredentials

    from app.middleware.auth import get_viewer

    token = create_access_token({"sub": "admin-1", "role": "ADMIN"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    viewer = await get_viewer(credentials=creds)
    assert viewer["role"] == "ADMIN"
    assert viewer["is_guest"] is False


@pytest.mark.asyncio
async def test_get_viewer_returns_demo_viewer_for_guest_token():
    from fastapi.security import HTTPAuthorizationCredentials

    from app.middleware.auth import get_viewer

    token = create_access_token({"sub": "guest-preview", "role": "GUEST", "is_guest": True})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    viewer = await get_viewer(credentials=creds)
    assert viewer["is_guest"] is True
    assert viewer["role"] == "GUEST"


@pytest.mark.asyncio
async def test_get_viewer_never_returns_none():
    """get_viewer must always resolve to an identity - the routes branch on it."""
    from app.middleware.auth import get_viewer

    assert await get_viewer(credentials=None) is not None
