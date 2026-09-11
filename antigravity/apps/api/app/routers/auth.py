from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.middleware.auth import create_access_token, get_current_user, verify_password, hash_password
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# Default admin password / pin in local environments
DEFAULT_ADMIN_PIN = "7090"
DEFAULT_ADMIN_HASH = hash_password(DEFAULT_ADMIN_PIN)


class LoginRequest(BaseModel):
    username: Optional[str] = "admin"
    password: Optional[str] = None
    pin: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    username: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """
    Authenticate administrative or family member user via PIN or Password.
    Returns signed JWT access token.
    """
    credential = req.password or req.pin or ""
    valid = False

    # Check against master secret or default pin
    if credential in [DEFAULT_ADMIN_PIN, settings.secret_key]:
        valid = True
    elif verify_password(credential, DEFAULT_ADMIN_HASH):
        valid = True

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, password, or security PIN.",
        )

    user_info = {
        "sub": "usr-admin-1",
        "username": req.username or "admin",
        "role": "ADMIN",
    }
    token = create_access_token(user_info)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user_info["sub"],
            username=user_info["username"],
            role=user_info["role"],
        ),
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return currently authenticated user identity and role."""
    return UserProfileResponse(
        id=current_user.get("id", "usr-1"),
        username=current_user.get("username", "admin"),
        role=current_user.get("role", "ADMIN"),
    )
