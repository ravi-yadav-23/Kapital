import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_public_cannot_trigger_sync():
    """Unauthenticated POST /api/ipos/sync must return HTTP 401 or 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/ipos/sync")
        assert res.status_code in (401, 403), f"Expected 401/403 but got {res.status_code}"


@pytest.mark.asyncio
async def test_guest_cannot_trigger_sync():
    """Guest token cannot trigger market scraping / sync pipeline."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create a guest session
        login_res = await client.post("/api/auth/guest-login")
        assert login_res.status_code == 200
        guest_token = login_res.json()["access_token"]

        res = await client.post(
            "/api/ipos/sync",
            headers={"Authorization": f"Bearer {guest_token}"}
        )
        assert res.status_code in (401, 403), f"Expected 401/403 for guest but got {res.status_code}"
