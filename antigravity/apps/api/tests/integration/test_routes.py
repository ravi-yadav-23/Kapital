import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_ipos_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/ipos")
        assert res.status_code == 200
        assert len(res.json()) >= 1

@pytest.mark.asyncio
async def test_funds_summary_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/funds/summary")
        assert res.status_code == 200
        data = res.json()
        assert "total_family_balance" in data
        assert "total_available" in data

@pytest.mark.asyncio
async def test_orders_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/orders")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

@pytest.mark.asyncio
async def test_reports_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/reports")
        assert res.status_code == 200
        assert len(res.json()) >= 1
