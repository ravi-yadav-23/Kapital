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
    assert data[0]["overall_score"] == 82


@pytest.mark.asyncio
async def test_accounts_route(client: AsyncClient, seed_data):
    res = await client.get("/api/accounts")
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
