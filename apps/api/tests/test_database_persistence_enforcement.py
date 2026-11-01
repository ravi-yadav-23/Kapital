import pytest
from pydantic import ValidationError
from app.config import Settings


def test_production_rejects_sqlite_database_url():
    """In production, SQLite or /tmp databases are forbidden."""
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="849204",
            database_url="sqlite+aiosqlite:////tmp/kapitl_local.db",
        )


def test_production_accepts_postgresql_database_url():
    """In production, managed PostgreSQL URL is required."""
    s = Settings(
        environment="production",
        secret_key="a-very-strong-production-secret-key-32chars!",
        admin_pin="849204",
        database_url="postgresql+asyncpg://postgres:pass@db.example.com:5432/kapitl",
    )
    assert "postgresql" in s.database_url
