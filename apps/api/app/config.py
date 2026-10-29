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
    cors_origins: Any = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
            "https://kapital-gamma-nine.vercel.app",
        ]

    @model_validator(mode="after")
    def validate_secret_key(self):
        val = (self.secret_key or "").strip()
        if self.environment == "production":
            if not val or val == _INSECURE_DEFAULT_KEY:
                raise ValueError(
                    "In production, SECRET_KEY must be set to a strong, private secret (cannot be empty or default)."
                )
            if len(val) < 32:
                raise ValueError("In production, SECRET_KEY must be at least 32 characters.")
        elif not val:
            self.secret_key = _INSECURE_DEFAULT_KEY
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
    default_ai_model: str = "llama-3.3-70b-versatile"

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
