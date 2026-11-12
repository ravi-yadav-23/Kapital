"""F18 / D5: no notification channel is switched on by default while no sender exists."""
from app.routers.settings import DEFAULT_SETTINGS


def test_notification_channels_are_off_by_default():
    n = DEFAULT_SETTINGS["notifications"]
    assert n["telegram_enabled"] is False
    assert n["whatsapp_enabled"] is False
    assert n["email_enabled"] is False
