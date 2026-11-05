from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import List, Any
import json
import logging
import secrets

logger = logging.getLogger("config")

_INSECURE_DEFAULT_KEY = "kapitl-default-development-secret-key"


class Settings(BaseSettings):
    # App
    app_name: str = "Kapitl API"
    environment: str = "development"
    secret_key: str = _INSECURE_DEFAULT_KEY

    # --- Separated secret keys ---
    # Used ONLY for JWT signing. Falls back to secret_key in dev.
    jwt_secret_key: str = ""
    # Used ONLY for Fernet symmetric encryption. Must be a valid 44-char URL-safe base64 key.
    # Leave empty in dev to auto-generate or fall back to sha256(secret_key).
    fernet_key: str = ""
    # Used ONLY for X-API-Key service-to-service authentication.
    # Leave empty in dev to disable API key auth entirely.
    master_api_key: str = ""

    cors_origins: Any = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
        "https://kapital-gamma-nine.vercel.app",
    ]

    @field_validator("cors_origins", mode="after")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        elif isinstance(v, list):
            return [str(x).strip() for x in v]
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
            "http://localhost:3003",
            "http://127.0.0.1:3003",
            "https://kapital-gamma-nine.vercel.app",
        ]

    @model_validator(mode="after")
    def validate_production_security(self):
        from cryptography.fernet import Fernet

        val_sec = (self.secret_key or "").strip()
        val_pin = (self.admin_pin or "").strip()
        is_production = self.environment.lower() in ("production", "prod")

        # --- PIN strength check: enforced in BOTH production AND serverless ---
        if is_production:
            # Secret key checks
            if not val_sec or val_sec == _INSECURE_DEFAULT_KEY:
                raise ValueError(
                    "In production, SECRET_KEY must be set to a strong, private secret (cannot be empty or default)."
                )
            if len(val_sec) < 32:
                raise ValueError("In production, SECRET_KEY must be at least 32 characters.")

            # Admin PIN checks — minimum 6 characters in production
            if not val_pin:
                raise ValueError("In production, ADMIN_PIN must be explicitly set.")
            if val_pin in ["1234", "0000", "1111", "123456", "000000", "111111"]:
                raise ValueError("In production, ADMIN_PIN cannot be a trivial or default PIN.")
            if len(val_pin) < 6:
                raise ValueError("In production, ADMIN_PIN must be at least 6 digits/characters.")

            # Database persistence check
            db_url = (self.database_url or "").strip().lower()
            if not db_url.startswith("postgresql") and not db_url.startswith("postgres"):
                raise ValueError(
                    "In production, DATABASE_URL must be a managed PostgreSQL connection "
                    "(e.g. postgresql+asyncpg://...). SQLite is forbidden in production to prevent data loss."
                )

            # Auto-populate separated keys if not explicitly provided
            if not self.jwt_secret_key:
                self.jwt_secret_key = self.secret_key
            if not self.master_api_key:
                self.master_api_key = self.secret_key
            if not self.fernet_key:
                import base64, hashlib
                derived = base64.urlsafe_b64encode(hashlib.sha256(self.secret_key.encode()).digest()).decode()
                self.fernet_key = derived
        else:
            # Development / test mode
            if not val_sec or val_sec == _INSECURE_DEFAULT_KEY:
                self.secret_key = _INSECURE_DEFAULT_KEY

            # Auto-generate a Fernet key in dev if not provided
            if not self.fernet_key:
                self.fernet_key = Fernet.generate_key().decode()

            # Warn (not raise) about default admin PIN in dev
            if val_pin in ["1234", "0000", "1111", "", "123456"]:
                logger.warning(
                    "SECURITY WARNING: ADMIN_PIN is set to a trivial default ('%s'). "
                    "Set a strong PIN (min 8 chars) before deploying to production.",
                    val_pin or "(empty)",
                )

        return self

    # Database
    database_url: str = "sqlite+aiosqlite:///./kapitl_local.db"
    redis_url: str = "redis://localhost:6379/0"

    # Angel One — list of account configs
    angel_accounts_json: str = "[]"

    # AI
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    default_ai_provider: str = "groq"
    default_ai_model: str = "openai/gpt-oss-120b"

    # Security & Auth
    admin_pin: str = "1234"
    google_client_id: str = "817266880199-0gilousjp4gnrbve1tli77db7c5v62oo.apps.googleusercontent.com"
    google_client_secret: str = ""
    allowed_email: str = ""
    admin_totp_secret: str = ""

    # IPO Data Sources
    ipoalerts_api_key: str = ""  # Free key from ipoalerts.in — sign up at https://ipoalerts.in

    # NSE compliance
    static_ip: str = ""
    static_mac: str = "fe80::216e:6507:4b9c:9045"
    client_local_ip: str = "127.0.0.1"

    class Config:
        env_file = ".env"

    @property
    def angel_accounts(self) -> List[dict]:
        if not self.angel_accounts_json or not self.angel_accounts_json.strip():
            return []
        try:
            return json.loads(self.angel_accounts_json)
        except Exception:
            return []


settings = Settings()
