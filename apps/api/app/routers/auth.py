import io
import base64
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
import httpx
import pyotp
import qrcode

from app.middleware.auth import (
    create_access_token,
    create_temp_2fa_token,
    decode_token,
    get_current_user,
    verify_password,
    hash_password,
)
from app.config import settings

logger = logging.getLogger("auth")
router = APIRouter(prefix="/auth", tags=["auth"])

# Local persistent secret storage path for when not provided in .env
TOTP_STORE_FILE = Path(__file__).resolve().parent.parent.parent / ".totp_secret"


def get_admin_totp_secret() -> Optional[str]:
    """Retrieve existing TOTP secret from settings or persistent local file."""
    if settings.admin_totp_secret and settings.admin_totp_secret.strip():
        return settings.admin_totp_secret.strip()
    if TOTP_STORE_FILE.exists():
        try:
            val = TOTP_STORE_FILE.read_text().strip()
            if val:
                return val
        except Exception as e:
            logger.warning(f"Could not read TOTP store file: {e}")
    return None


def save_admin_totp_secret(secret: str) -> None:
    """Save newly verified TOTP secret."""
    try:
        TOTP_STORE_FILE.write_text(secret.strip())
    except Exception as e:
        logger.error(f"Failed to persist TOTP secret: {e}")


def generate_qr_data_url(otpauth_uri: str) -> str:
    """Generates a base64 PNG data URL of the QR code for instant display."""
    img = qrcode.make(otpauth_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: Optional[str] = "admin"
    password: Optional[str] = None
    pin: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token returned by Google Identity Services


class TotpVerifyRequest(BaseModel):
    temp_token: str
    code: str


class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    role: str
    is_guest: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class GoogleAuthResponse(BaseModel):
    status: str  # "REQUIRE_2FA" or "SETUP_2FA"
    temp_token: str
    email: str
    name: Optional[str] = None
    secret: Optional[str] = None
    otpauth_uri: Optional[str] = None
    qr_data_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(req: GoogleAuthRequest):
    """
    Step 1: Authenticate with Google ID Token.
    - Validates token against Google's tokeninfo API.
    - Strictly enforces email whitelist (ALLOWED_EMAIL).
    - If email matches, checks if TOTP is configured:
      * If not configured: Generates new TOTP secret & QR code data URL (One-Time Setup).
      * If configured: Returns challenge for 6-digit Google Authenticator code.
    """
    if not req.credential or not req.credential.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google authentication credential.",
        )

    # 1. Verify token with Google
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": req.credential.strip()},
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google token.",
                )
            token_info = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Google token verification request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to reach Google authentication service.",
        )

    # Validate audience (aud) claim if GOOGLE_CLIENT_ID is configured
    google_client_id = getattr(settings, "google_client_id", None)
    if isinstance(google_client_id, str) and google_client_id.strip():
        token_aud = token_info.get("aud")
        if token_aud != google_client_id.strip():
            logger.warning(f"Google token aud mismatch: expected {google_client_id}, got {token_aud}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token was not issued for this application.",
            )

    # Validate email
    email = token_info.get("email", "").strip().lower()
    email_verified = str(token_info.get("email_verified", "")).lower() == "true"

    if not email or not email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )

    # 2. Enforce Strict Email Whitelist (Fail closed)
    allowed_email = (settings.allowed_email or "").strip().lower()
    if not allowed_email:
        logger.error("ALLOWED_EMAIL is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Server is not configured with an ALLOWED_EMAIL administrator whitelist.",
        )
    if email != allowed_email:
        logger.warning(f"Unauthorized Google login attempt from: {email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: '{email}' is not authorized to access Kapitl. Only the registered administrator email is permitted.",
        )

    user_name = token_info.get("name", "Kapitl Admin")

    # 3. Check TOTP configuration
    totp_secret = get_admin_totp_secret()

    if not totp_secret:
        # First-time setup: Generate new secret and one-time QR code
        new_secret = pyotp.random_base32()
        otpauth_uri = pyotp.totp.TOTP(new_secret).provisioning_uri(
            name=email,
            issuer_name="Kapitl",
        )
        qr_data_url = generate_qr_data_url(otpauth_uri)

        # Temporary token containing pending secret for verification
        temp_token = create_temp_2fa_token({
            "email": email,
            "name": user_name,
            "pending_secret": new_secret,
        })

        return GoogleAuthResponse(
            status="SETUP_2FA",
            temp_token=temp_token,
            email=email,
            name=user_name,
            secret=new_secret,
            otpauth_uri=otpauth_uri,
            qr_data_url=qr_data_url,
        )

    # Returning user: prompt for standard 6-digit code
    temp_token = create_temp_2fa_token({
        "email": email,
        "name": user_name,
    })

    return GoogleAuthResponse(
        status="REQUIRE_2FA",
        temp_token=temp_token,
        email=email,
        name=user_name,
    )


@router.post("/verify-totp", response_model=LoginResponse)
async def verify_totp(req: TotpVerifyRequest):
    """
    Step 2: Validate 6-digit Google Authenticator code against TOTP secret.
    Once verified:
    - If this was first-time setup, persists the secret.
    - Issues full JWT session access token.
    """
    # 1. Decode temporary token
    payload = decode_token(req.temp_token)
    if payload.get("type") != "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA session. Please sign in with Google again.",
        )

    code = req.code.strip().replace(" ", "")
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticator code must be exactly 6 digits.",
        )

    # 2. Determine TOTP secret (either pending from first-time setup or saved)
    is_setup = "pending_secret" in payload
    totp_secret = payload.get("pending_secret") or get_admin_totp_secret()

    if not totp_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No 2FA secret found. Please restart Google sign-in.",
        )

    # 3. Verify TOTP with pyotp (allowing +/- 30 second window drift)
    totp = pyotp.TOTP(totp_secret)
    is_valid = totp.verify(code, valid_window=1)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect 6-digit code. Please check your Google Authenticator app and try again.",
        )

    # If first time, save the verified secret
    if is_setup:
        save_admin_totp_secret(totp_secret)
        logger.info("Successfully configured and saved Admin TOTP secret.")

    # 4. Issue full access token
    email = payload.get("email", "")
    username = payload.get("name", "Kapitl Admin")
    user_info = {
        "sub": "admin-1",
        "username": username,
        "email": email,
        "role": "ADMIN",
        "is_guest": False,
    }
    token = create_access_token(user_info)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user_info["sub"],
            username=user_info["username"],
            email=user_info["email"],
            role=user_info["role"],
            is_guest=False,
        ),
    )


@router.post("/guest-login", response_model=LoginResponse)
async def guest_login():
    """
    Explore as Guest mode:
    Issues a restricted session token allowing browsing of IPOs, demo analytics,
    and blank dashboard views without access to real broker accounts or live orders.
    """
    user_info = {
        "sub": "guest-preview",
        "username": "Guest Explorer",
        "email": "guest@kapitl.local",
        "role": "GUEST",
        "is_guest": True,
    }
    token = create_access_token(user_info)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user_info["sub"],
            username=user_info["username"],
            email=user_info["email"],
            role=user_info["role"],
            is_guest=True,
        ),
    )


@router.post("/login", response_model=LoginResponse)
async def pin_login(req: LoginRequest):
    """
    Legacy / Emergency Administrative login via PIN or Master Password.
    """
    credential = req.password or req.pin or ""
    valid = False

    admin_pin = (getattr(settings, "admin_pin", None) or "").strip()
    if not admin_pin:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin PIN authentication is not configured on this server.",
        )
    admin_hash = hash_password(admin_pin)

    if credential in [admin_pin, settings.secret_key]:
        valid = True
    elif verify_password(credential, admin_hash):
        valid = True

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, password, or security PIN.",
        )

    user_info = {
        "sub": "usr-admin-1",
        "username": req.username or "Admin",
        "email": settings.allowed_email or "admin@kapitl.local",
        "role": "ADMIN",
        "is_guest": False,
    }
    token = create_access_token(user_info)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user_info["sub"],
            username=user_info["username"],
            email=user_info["email"],
            role=user_info["role"],
            is_guest=False,
        ),
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return currently authenticated user identity, role, and guest status."""
    return UserProfileResponse(
        id=current_user.get("id", "usr-1"),
        username=current_user.get("username", "User"),
        email=current_user.get("email"),
        role=current_user.get("role", "ADMIN"),
        is_guest=current_user.get("is_guest", False),
    )

