import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_guest_pnl_endpoints_return_structured_responses():
    """Both /api/funds/pnl-summary and /api/reports/pnl/summary return non-zero preview metrics for guests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login as guest
        login_res = await client.post("/api/auth/guest-login")
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Check /api/funds/pnl-summary
        res_funds = await client.get("/api/funds/pnl-summary", headers=headers)
        assert res_funds.status_code == 200
        data_funds = res_funds.json()
        assert "total_realized_pnl" in data_funds
        assert data_funds["total_realized_pnl"] > 0, "Guest preview must show non-zero realized PnL"
        assert "overall_roi_percent" in data_funds
        assert data_funds["overall_roi_percent"] > 0

        # 3. Check /api/reports/pnl/summary
        res_reports = await client.get("/api/reports/pnl/summary", headers=headers)
        assert res_reports.status_code == 200
        data_reports = res_reports.json()
        assert "total_invested" in data_reports
        assert "total_net_pnl" in data_reports
        assert data_reports["total_net_pnl"] > 0, "Guest report ledger should show demo realized PnL"
        assert "breakdown" in data_reports
        assert len(data_reports["breakdown"]) > 0, "Guest report ledger should include demo trades"
