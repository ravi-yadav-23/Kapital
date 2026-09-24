"""
test_auth.py — Auth System Unit Tests

Covers:
- JWT token lifecycle (create + decode)
- Password / PIN hashing helpers
- Google OAuth endpoint (mocked httpx call)
- TOTP setup + verify flow
- Guest login token structure
- require_admin dependency blocks GUEST role
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.middleware.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_temp_2fa_token,
    decode_access_token,
    decode_token,
    require_admin,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def test_password_hashing_roundtrip():
    """hash_password + verify_password must work for any string."""
    for raw in ["correct-horse-battery", "7090", "admin@kapitl", "🔐secret"]:
        hashed = hash_password(raw)
        assert hashed != raw, "Hash must differ from plaintext"
        assert verify_password(raw, hashed) is True, f"Verification failed for: {raw}"
        assert verify_password("wrong", hashed) is False


def test_password_wrong_input_fails():
    hashed = hash_password("correct")
    assert verify_password("incorrect", hashed) is False


# ─── JWT Token Lifecycle ───────────────────────────────────────────────────────

def test_jwt_access_token_lifecycle():
    """create_access_token → decode_access_token must round-trip all fields."""
    payload = {"sub": "admin-1", "username": "Ravi", "email": "ravi@kapitl.local", "role": "ADMIN"}
    token = create_access_token(payload)

    assert isinstance(token, str) and len(token) > 30

    decoded = decode_access_token(token)
    assert decoded["sub"] == "admin-1"
    assert decoded["username"] == "Ravi"
    assert decoded["email"] == "ravi@kapitl.local"
    assert decoded["role"] == "ADMIN"
    assert decoded["type"] == "access"
    assert "exp" in decoded


def test_jwt_temp_2fa_token_blocked_by_decode_access_token():
    """A 2fa_pending token must be rejected by decode_access_token (wrong type guard)."""
    temp_token = create_temp_2fa_token({"email": "ravi@kapitl.local", "name": "Ravi"})
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(temp_token)
    assert exc_info.value.status_code == 401
    assert "Two-factor" in exc_info.value.detail


def test_jwt_temp_token_accepted_by_decode_token():
    """decode_token (without type check) must accept 2fa_pending tokens."""
    temp_token = create_temp_2fa_token({"email": "ravi@kapitl.local", "pending_secret": "ABC"})
    decoded = decode_token(temp_token)
    assert decoded["type"] == "2fa_pending"
    assert decoded["email"] == "ravi@kapitl.local"
    assert decoded["pending_secret"] == "ABC"


# ─── Guest Login Token ────────────────────────────────────────────────────────

def test_guest_token_has_guest_role():
    """Guest login must issue a token with role=GUEST and is_guest=True."""
    guest_payload = {
        "sub": "guest-preview",
        "username": "Guest Explorer",
        "email": "guest@kapitl.local",
        "role": "GUEST",
        "is_guest": True,
    }
    token = create_access_token(guest_payload)
    decoded = decode_access_token(token)
    assert decoded["role"] == "GUEST"
    assert decoded["is_guest"] is True


# ─── require_admin dependency ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_require_admin_allows_admin_user():
    """require_admin must pass through when role=ADMIN."""
    admin_user = {"id": "admin-1", "role": "ADMIN", "is_guest": False, "username": "ravi", "email": "r@k.io"}
    result = await require_admin(current_user=admin_user)
    assert result == admin_user


@pytest.mark.asyncio
async def test_require_admin_blocks_guest_user():
    """require_admin must raise HTTP 403 for GUEST users."""
    guest_user = {"id": "guest-1", "role": "GUEST", "is_guest": True, "username": "Guest", "email": ""}
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(current_user=guest_user)
    assert exc_info.value.status_code == 403
    assert "restricted" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_require_admin_blocks_missing_role():
    """require_admin must raise HTTP 403 if role is not ADMIN."""
    unknown_user = {"id": "x", "role": "VIEWER", "is_guest": False, "username": "x", "email": ""}
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(current_user=unknown_user)
    assert exc_info.value.status_code == 403


# ─── Google OAuth Endpoint (mocked) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_google_auth_valid_email_first_setup():
    """
    Valid Google credential for the allowed email with no existing TOTP secret
    must return status=SETUP_2FA with a QR code and temp token.
    """
    from app.routers.auth import google_auth, GoogleAuthRequest, get_admin_totp_secret

    mock_token_info = {
        "email": "ravi@kapitl.local",
        "email_verified": "true",
        "name": "Ravi Dahiya",
        "sub": "google-uid-123",
    }

    with patch("app.routers.auth.settings") as mock_settings, \
         patch("app.routers.auth.get_admin_totp_secret", return_value=None), \
         patch("httpx.AsyncClient") as mock_http:
        mock_settings.allowed_email = "ravi@kapitl.local"
        mock_settings.secret_key = "test-secret-key"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_token_info

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_http.return_value = mock_client

        req = GoogleAuthRequest(credential="valid-id-token")
        response = await google_auth(req)

    assert response.status == "SETUP_2FA"
    assert response.email == "ravi@kapitl.local"
    assert response.temp_token is not None
    assert response.qr_data_url is not None
    assert response.secret is not None


@pytest.mark.asyncio
async def test_google_auth_wrong_email_rejected():
    """Google auth must raise HTTP 403 if email is not in the allowed whitelist."""
    from app.routers.auth import google_auth, GoogleAuthRequest

    mock_token_info = {
        "email": "attacker@evil.com",
        "email_verified": "true",
        "name": "Attacker",
    }

    with patch("app.routers.auth.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_http:
        mock_settings.allowed_email = "ravi@kapitl.local"
        mock_settings.secret_key = "test-secret-key"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_token_info

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_http.return_value = mock_client

        req = GoogleAuthRequest(credential="attacker-token")
        with pytest.raises(HTTPException) as exc_info:
            await google_auth(req)

    assert exc_info.value.status_code == 403
    assert "not authorized" in exc_info.value.detail.lower()


# ─── TOTP Verify Endpoint ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_totp_verify_correct_code_issues_token():
    """verify_totp with a valid TOTP code must return a full access token."""
    import pyotp
    from app.routers.auth import verify_totp, TotpVerifyRequest

    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()

    # Create a temp token carrying the pending secret (first-time setup)
    temp_token = create_temp_2fa_token({"email": "ravi@kapitl.local", "name": "Ravi", "pending_secret": secret})

    with patch("app.routers.auth.save_admin_totp_secret"):
        req = TotpVerifyRequest(temp_token=temp_token, code=code)
        response = await verify_totp(req)

    assert response.access_token is not None
    assert response.user.role == "ADMIN"
    assert response.user.is_guest is False


@pytest.mark.asyncio
async def test_totp_verify_wrong_code_raises_400():
    """verify_totp with the wrong code must raise HTTP 400."""
    import pyotp
    from app.routers.auth import verify_totp, TotpVerifyRequest

    secret = pyotp.random_base32()
    temp_token = create_temp_2fa_token({"email": "ravi@kapitl.local", "name": "Ravi", "pending_secret": secret})

    req = TotpVerifyRequest(temp_token=temp_token, code="000000")
    with pytest.raises(HTTPException) as exc_info:
        await verify_totp(req)
    assert exc_info.value.status_code == 400
    assert "Incorrect" in exc_info.value.detail
