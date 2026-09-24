from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.db.database import get_db
from app.models.setting import SystemSetting
from app.utils.security import encrypt_credential, decrypt_credential, mask_secret
from app.config import settings

from app.middleware.auth import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


SENSITIVE_API_KEYS = {"groq_api_key", "gemini_api_key", "anthropic_api_key"}

DEFAULT_SETTINGS: Dict[str, Any] = {
    "auto_apply_min_score": 80,
    "watch_min_score": 60,
    "avoid_below_score": 45,
    "default_upi_vpa": "",
    "max_allocation_pct": 80,
    "limit_buffer_pct": 5.0,
    "ai_provider": settings.default_ai_provider,
    "ai_model": settings.default_ai_model,
    "groq_api_key": "",
    "gemini_api_key": "",
    "anthropic_api_key": "",
    "notifications": {
        "score_alerts": True,
        "allotment_alerts": True,
        "listing_sell_alerts": True,
        "fund_unlock_alerts": True,
        "telegram_enabled": True,
        "whatsapp_enabled": True,
        "email_enabled": False,
    },
}


def _mask_settings(settings_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy of settings with sensitive API keys masked."""
    masked = dict(settings_dict)
    for key in SENSITIVE_API_KEYS:
        val = masked.get(key)
        if val:
            masked[key] = mask_secret(val)
        else:
            masked[key] = ""
    return masked


async def get_decrypted_setting(db: AsyncSession, setting_field: str) -> Optional[str]:
    """Retrieve and decrypt a specific sensitive key from system_settings."""
    stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
    res = await db.execute(stmt)
    setting_row = res.scalar_one_or_none()
    if not setting_row or not setting_row.value:
        return None
    raw_val = setting_row.value.get(setting_field)
    return decrypt_credential(raw_val) if raw_val else None


from app.middleware.auth import require_admin, get_current_user_optional

@router.get("")
async def get_app_settings(
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    """Retrieve current platform settings with API keys masked. Returns defaults for guest mode."""
    if isinstance(user, dict) and user.get("is_guest"):
        return _mask_settings(DEFAULT_SETTINGS)

    stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
    res = await db.execute(stmt)
    setting_row = res.scalar_one_or_none()

    if not setting_row:
        # Encrypt defaults if any
        encrypted_defaults = dict(DEFAULT_SETTINGS)
        for key in SENSITIVE_API_KEYS:
            if encrypted_defaults.get(key):
                encrypted_defaults[key] = encrypt_credential(encrypted_defaults[key])

        new_row = SystemSetting(
            id=str(uuid.uuid4()),
            key="app_preferences",
            value=encrypted_defaults,
        )
        db.add(new_row)
        await db.commit()
        return _mask_settings(encrypted_defaults)

    return _mask_settings(setting_row.value or DEFAULT_SETTINGS)


@router.post("")
async def save_app_settings(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    """Update and securely persist platform configuration with encrypted API keys."""
    stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
    res = await db.execute(stmt)
    setting_row = res.scalar_one_or_none()

    current_val = dict(setting_row.value if setting_row else DEFAULT_SETTINGS)

    # Sanitize and encrypt sensitive keys
    sanitized_payload = dict(payload)
    for key in SENSITIVE_API_KEYS:
        if key in sanitized_payload:
            new_val = sanitized_payload[key]
            # If empty string, clear it
            if not new_val:
                sanitized_payload[key] = ""
            # If user sent back a masked string with "...", preserve current encrypted value
            elif "..." in str(new_val) or str(new_val).startswith("****"):
                sanitized_payload[key] = current_val.get(key, "")
            else:
                # Real new API key provided: encrypt before saving
                sanitized_payload[key] = encrypt_credential(new_val)

    current_val.update(sanitized_payload)

    if setting_row:
        setting_row.value = current_val
    else:
        setting_row = SystemSetting(
            id=str(uuid.uuid4()),
            key="app_preferences",
            value=current_val,
        )
        db.add(setting_row)

    await db.commit()
    await db.refresh(setting_row)
    return {"success": True, "settings": _mask_settings(setting_row.value)}
