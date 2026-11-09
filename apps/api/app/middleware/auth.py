import logging
import secrets as secrets_module
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

logger = logging.getLogger("auth")

# Password / PIN hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours (was 7 days — reduced for security)

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hashes a plaintext password or PIN using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password or PIN against bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def _get_secret_key() -> str:
    # Prefer dedicated JWT key if valid, else fall back to secret_key
    jwt_key = (settings.jwt_secret_key or "").strip()
    sec_key = (settings.secret_key or "").strip()
    key = jwt_key if jwt_key and len(jwt_key) >= 16 else sec_key
    if not key or len(key) < 16:
        raise ValueError(
            "Invalid SECRET_KEY: A secure key of at least 16 characters must be configured "
            "(set JWT_SECRET_KEY or SECRET_KEY in settings)."
        )
    return key


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def create_temp_2fa_token(data: Dict[str, Any], expires_minutes: int = 5) -> str:
    """Generates a short-lived temporary token specifically for 2FA challenge verification."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire, "type": "2fa_pending"})
    encoded_jwt = jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decodes and validates any Kapitl JWT token."""
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a session access token (disallowing pre-2FA tokens)."""
    payload = decode_token(token)
    if payload.get("type") == "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Two-factor authentication code required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Dict[str, Any]:
    """
    FastAPI security dependency to verify JWT token or X-API-Key header.
    Returns user identity dict with role ('ADMIN' or 'GUEST').
    """
    # 1. Check Bearer Token
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        role = payload.get("role", "ADMIN")
        return {
            "id": payload.get("sub", "admin-1"),
            "email": payload.get("email", ""),
            "username": payload.get("username", "admin"),
            "role": role,
            "is_guest": (role == "GUEST"),
        }

    # 2. Check X-API-Key Header
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        # Use dedicated MASTER_API_KEY with constant-time comparison to prevent timing attacks.
        # Fall back to secret_key only in dev if master_api_key is not set.
        expected_key = (settings.master_api_key or "").strip() or (settings.secret_key or "").strip()
        if expected_key and secrets_module.compare_digest(api_key_header.encode(), expected_key.encode()):
            return {"id": "system-api-key", "email": "", "username": "system", "role": "ADMIN", "is_guest": False}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )

    # 3. Development fallback ONLY when running automated tests without auth config
    if settings.environment.lower() == "test" and settings.environment.lower() not in ["production", "prod"]:
        return {"id": "test-admin", "email": "test@kapitl.local", "username": "admin", "role": "ADMIN", "is_guest": False}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please sign in with Google.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_admin(
    current_user: Dict[str, Any] = Security(get_current_user),
) -> Dict[str, Any]:
    """FastAPI security dependency requiring ADMIN role. Blocks GUEST users."""
    if current_user.get("role") != "ADMIN" or current_user.get("is_guest"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: This action requires Administrator privileges and is disabled in Guest mode.",
        )
    return current_user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Optional[Dict[str, Any]]:
    """
    Optional user dependency that returns None when unauthenticated (401),
    while letting unexpected server errors (500) or forbidden states propagate cleanly.
    """
    try:
        return await get_current_user(request, credentials)
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            return None
        raise e


# Identity handed to callers that are NOT an authenticated administrator.
# It is deliberately shaped like a normal user dict so routes can keep using
# `viewer.get("is_guest")` to decide whether to serve the demo dataset.
DEMO_VIEWER: Dict[str, Any] = {
    "id": "demo-viewer",
    "email": "",
    "username": "guest",
    "role": "GUEST",
    "is_guest": True,
}


async def get_viewer(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Dict[str, Any]:
    """
    Read-side viewer dependency.

    Returns an ADMIN identity ONLY for a valid, non-guest ADMIN access token.
    Every other caller - no token, a malformed/expired/garbage token, a guest
    token, or a token that has not completed 2FA - resolves to the demo viewer,
    so the route serves the public demo dataset instead of real portfolio data.

    This dependency never raises and never returns None.
    """
    if not (credentials and credentials.credentials):
        return dict(DEMO_VIEWER)

    try:
        payload = decode_access_token(credentials.credentials)
    except HTTPException:
        # Invalid / expired / pre-2FA token -> treat as a plain guest viewer.
        logger.warning("Viewer request carried an invalid token; serving demo data.")
        return dict(DEMO_VIEWER)

    role = payload.get("role", "ADMIN")
    is_guest = (role == "GUEST") or bool(payload.get("is_guest"))
    if role == "ADMIN" and not is_guest:
        return {
            "id": payload.get("sub", "admin-1"),
            "email": payload.get("email", ""),
            "username": payload.get("username", "admin"),
            "role": "ADMIN",
            "is_guest": False,
        }

    return dict(DEMO_VIEWER)

