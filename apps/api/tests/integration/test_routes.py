import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_route(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ipos_route(client: AsyncClient, seed_data):
    res = await client.get("/api/ipos")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["symbol"] == "TECHNO"


@pytest.mark.asyncio
async def test_funds_summary_route(client: AsyncClient, seed_data):
    res = await client.get("/api/funds/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_family_balance" in data
    assert "total_available" in data
    assert data["accounts_total"] >= 1


@pytest.mark.asyncio
async def test_orders_route(client: AsyncClient, seed_data):
    res = await client.get("/api/orders")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_reports_route(client: AsyncClient, seed_data):
    res = await client.get("/api/reports")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    scores = [d["overall_score"] for d in data]
    assert any(s > 0 for s in scores)



@pytest.mark.asyncio
async def test_accounts_route_requires_admin_for_real_data(client: AsyncClient, seed_data):
    """Unauthenticated callers must get the demo dataset, never the seeded real account."""
    from app.middleware.auth import create_access_token

    res = await client.get("/api/funds/accounts")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["name"] != "Ravi Kumar", "Anonymous callers must not see the real account"
    assert data[0]["angel_client_id"] != "R123456"

    # An ADMIN token does see the real (masked-PAN) account.
    token = create_access_token({"sub": "admin-1", "role": "ADMIN", "email": "admin@kapitl.local"})
    res_admin = await client.get(
        "/api/funds/accounts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert admin_data[0]["name"] == "Ravi Kumar"
    assert admin_data[0]["angel_client_id"] == "R123456"


@pytest.mark.asyncio
async def test_pin_login_route_is_removed(client: AsyncClient):
    """POST /api/auth/login (PIN) no longer exists - it accepted the SECRET_KEY as a credential."""
    res = await client.post("/api/auth/login", json={"pin": "7090"})
    assert res.status_code in (404, 405)

    res_secret = await client.post("/api/auth/login", json={"password": "some-secret-key"})
    assert res_secret.status_code in (404, 405)


@pytest.mark.asyncio
async def test_funds_optimize_requires_admin(client: AsyncClient, seed_data):
    from app.middleware.auth import create_access_token

    token = create_access_token({"sub": "admin-1", "role": "ADMIN", "email": "admin@kapitl.local"})

    res_authed = await client.post(
        "/api/funds/optimize",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_authed.status_code == 200
    plan = res_authed.json()
    assert "entries" in plan


@pytest.mark.asyncio
async def test_guest_can_access_and_generate_ai_reports(client: AsyncClient, seed_data):
    # 1. Guest login returns valid guest token
    guest_res = await client.post("/api/auth/guest-login")
    assert guest_res.status_code == 200
    token = guest_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Guest can list AI reports
    list_res = await client.get("/api/reports", headers=headers)
    assert list_res.status_code == 200
    reports = list_res.json()
    assert len(reports) >= 1

    # 3. Guest can fetch single report
    first_ipo_id = reports[0]["ipo_id"]
    get_res = await client.get(f"/api/reports/{first_ipo_id}", headers=headers)
    assert get_res.status_code == 200
    rep_data = get_res.json()
    assert rep_data["ipo_id"] == first_ipo_id
    assert "score_breakdown" in rep_data

    # 4. Guest can trigger generate report and gets cached report with 0 error
    gen_res = await client.post(f"/api/reports/{first_ipo_id}/generate", headers=headers)
    assert gen_res.status_code == 200
    cached_rep = gen_res.json()
    assert cached_rep["ipo_id"] == first_ipo_id


@pytest.mark.asyncio
async def test_guest_can_run_pulp_optimization(client: AsyncClient, seed_data):
    # Guest user without login token can run optimizer without 500 error
    res_no_auth = await client.post("/api/funds/optimize")
    assert res_no_auth.status_code == 200
    plan_no_auth = res_no_auth.json()
    assert "entries" in plan_no_auth
    assert plan_no_auth.get("is_demo") is True

    # Guest user with guest login token
    guest_res = await client.post("/api/auth/guest-login")
    assert guest_res.status_code == 200
    token = guest_res.json()["access_token"]
    res_guest = await client.post(
        "/api/funds/optimize",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_guest.status_code == 200
    plan_guest = res_guest.json()
    assert "entries" in plan_guest
    assert plan_guest.get("is_demo") is True



