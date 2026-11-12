"""F22: server errors must not echo exception text, tracebacks or wildcard CORS to callers."""
from unittest.mock import patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app

SECRET = "boom-secret-detail"


def _assert_generic(resp):
    assert resp.status_code == 500
    text = resp.text
    assert SECRET not in text
    assert "traceback" not in text.lower()
    assert "Traceback" not in text
    assert resp.headers.get("access-control-allow-origin") != "*"


@pytest.mark.asyncio
async def test_unhandled_exception_returns_generic_500():
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        with patch("app.routers.ipos.ipo_service.get_all_ipos", side_effect=RuntimeError(SECRET)):
            resp = await c.get("/api/ipos")
    _assert_generic(resp)
    assert resp.json()["detail"]


@pytest.mark.asyncio
async def test_optimizer_500_does_not_echo_exception_text():
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        with patch("app.routers.funds.AllocationOptimizer.solve_allocation", side_effect=RuntimeError(SECRET)):
            resp = await c.post("/api/funds/optimize")
    _assert_generic(resp)
