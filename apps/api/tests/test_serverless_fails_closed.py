"""F21: a serverless deploy that forgot ENVIRONMENT=production must not run with the public dev key."""
import pytest

from app.config import Settings, _INSECURE_DEFAULT_KEY


@pytest.fixture
def serverless(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    for k in ("SECRET_KEY", "JWT_SECRET_KEY", "MASTER_API_KEY", "ADMIN_TOTP_SECRET", "FERNET_KEY"):
        monkeypatch.delenv(k, raising=False)


def test_serverless_without_environment_is_treated_as_production(serverless, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    s = Settings(_env_file=None)
    assert s.environment == "production"
    assert s.secret_key != _INSECURE_DEFAULT_KEY
    assert len(s.secret_key) >= 32


def test_serverless_signing_key_is_not_the_public_default(serverless, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    s = Settings(_env_file=None)
    assert s.jwt_secret_key == s.secret_key != _INSECURE_DEFAULT_KEY
    assert s.master_api_key == ""  # API-key auth stays disabled unless explicitly configured


def test_local_development_is_unchanged(monkeypatch):
    for k in ("VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "SECRET_KEY"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    s = Settings(_env_file=None)
    assert s.environment == "development"
    assert s.secret_key == _INSECURE_DEFAULT_KEY
