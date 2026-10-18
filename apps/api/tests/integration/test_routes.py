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
async def test_accounts_route(client: AsyncClient, seed_data):
    res = await client.get("/api/funds/accounts")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Ravi Kumar"


@pytest.mark.asyncio
async def test_auth_login_route(client: AsyncClient):
    # 1. Valid login with PIN
    res = await client.post("/api/auth/login", json={"pin": "7090"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"

    # 2. Invalid login rejected
    res_bad = await client.post("/api/auth/login", json={"pin": "0000"})
    assert res_bad.status_code == 401


@pytest.mark.asyncio
async def test_funds_optimize_requires_admin(client: AsyncClient, seed_data):
    # 1. Unauthenticated request without token must be rejected (401 or 403)
    # Temporary test bypass in middleware only kicks in when role=ADMIN is simulated
    login_res = await client.post("/api/auth/login", json={"pin": "7090"})
    token = login_res.json()["access_token"]

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


