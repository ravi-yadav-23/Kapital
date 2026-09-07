from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.db.database import get_db
from app.models.setting import SystemSetting

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS: Dict[str, Any] = {
    "auto_apply_min_score": 80,
    "watch_min_score": 60,
    "avoid_below_score": 45,
    "default_upi_vpa": "ravi@okhdfcbank",
    "max_allocation_pct": 80,
    "limit_buffer_pct": 5.0,
    "ai_provider": "groq",  # groq, gemini, anthropic
    "ai_model": "llama-3.3-70b-versatile",
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


@router.get("")
async def get_app_settings(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve current platform settings from PostgreSQL."""
    stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
    res = await db.execute(stmt)
    setting_row = res.scalar_one_or_none()

    if not setting_row:
        # Save default settings on first access
        new_row = SystemSetting(
            id=str(uuid.uuid4()),
            key="app_preferences",
            value=DEFAULT_SETTINGS,
        )
        db.add(new_row)
        await db.commit()
        return DEFAULT_SETTINGS

    return setting_row.value


@router.post("")
async def save_app_settings(payload: Dict[str, Any], db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Update and persist platform configuration and alert thresholds."""
    stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
    res = await db.execute(stmt)
    setting_row = res.scalar_one_or_none()

    if setting_row:
        merged = dict(setting_row.value or DEFAULT_SETTINGS)
        merged.update(payload)
        setting_row.value = merged
    else:
        merged = dict(DEFAULT_SETTINGS)
        merged.update(payload)
        setting_row = SystemSetting(
            id=str(uuid.uuid4()),
            key="app_preferences",
            value=merged,
        )
        db.add(setting_row)

    await db.commit()
    await db.refresh(setting_row)
    return {"success": True, "settings": setting_row.value}
