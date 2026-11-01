import pytest
from pydantic import ValidationError
from app.config import Settings, _INSECURE_DEFAULT_KEY


def test_production_rejects_default_admin_pin():
    """In production, admin_pin cannot be default '1234' or trivial."""
    with pytest.raises(ValidationError, match="ADMIN_PIN"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="1234",
            database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
        )


def test_production_rejects_short_admin_pin():
    """In production, admin_pin must be at least 6 characters."""
    with pytest.raises(ValidationError, match="ADMIN_PIN"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="9999",
            database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
        )


def test_production_rejects_trivial_sequences():
    """In production, reject trivial repeating pins."""
    for bad_pin in ["000000", "111111", "123456"]:
        with pytest.raises(ValidationError, match="ADMIN_PIN"):
            Settings(
                environment="production",
                secret_key="a-very-strong-production-secret-key-32chars!",
                admin_pin=bad_pin,
                database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
            )


def test_production_accepts_strong_pin():
    """Production mode initializes successfully with a strong 6+ digit non-trivial PIN."""
    s = Settings(
        environment="production",
        secret_key="a-very-strong-production-secret-key-32chars!",
        admin_pin="849204",
        database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
    )
    assert s.admin_pin == "849204"
    assert s.environment == "production"

