"""F25: SECRET_KEY must not double as an admin API key, no env-based auth bypass, TOTP brute-force limit."""
import pyotp
import pytest
from httpx import AsyncClient, ASGITransport

from app.config import settings
from app.main import app
from app.middleware.auth import create_temp_2fa_token
from app.routers import auth as auth_router


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_secret_key_is_not_accepted_as_x_api_key(monkeypatch):
    monkeypatch.setattr(settings, "master_api_key", "")
    async with _client() as c:
        resp = await c.get("/api/auth/me", headers={"X-API-Key": settings.secret_key})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_explicit_master_api_key_still_works(monkeypatch):
    monkeypatch.setattr(settings, "master_api_key", "m" * 40)
    async with _client() as c:
        ok = await c.get("/api/auth/me", headers={"X-API-Key": "m" * 40})
        bad = await c.get("/api/auth/me", headers={"X-API-Key": "x" * 40})
    assert ok.status_code == 200 and ok.json()["role"] == "ADMIN"
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_environment_test_grants_no_admin(monkeypatch):
    monkeypatch.setattr(settings, "environment", "test")
    async with _client() as c:
        resp = await c.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_totp_attempts_are_limited(monkeypatch):
    secret = pyotp.random_base32()
    monkeypatch.setattr(auth_router, "get_admin_totp_secret", lambda: secret)
    monkeypatch.setattr(auth_router, "_totp_failures", {}, raising=False)
    temp = create_temp_2fa_token({"email": "limit@kapitl.local", "name": "L"})
    async with _client() as c:
        for _ in range(5):
            r = await c.post("/api/auth/verify-totp", json={"temp_token": temp, "code": "000000"})
            assert r.status_code == 400
        good = pyotp.TOTP(secret).now()
        r = await c.post("/api/auth/verify-totp", json={"temp_token": temp, "code": good})
    assert r.status_code == 429


@pytest.mark.asyncio
async def test_totp_success_still_works_and_resets_counter(monkeypatch):
    secret = pyotp.random_base32()
    monkeypatch.setattr(auth_router, "get_admin_totp_secret", lambda: secret)
    monkeypatch.setattr(auth_router, "_totp_failures", {}, raising=False)
    temp = create_temp_2fa_token({"email": "ok@kapitl.local", "name": "O"})
    async with _client() as c:
        for _ in range(3):
            await c.post("/api/auth/verify-totp", json={"temp_token": temp, "code": "000000"})
        r = await c.post("/api/auth/verify-totp", json={"temp_token": temp, "code": pyotp.TOTP(secret).now()})
    assert r.status_code == 200 and r.json()["user"]["role"] == "ADMIN"
