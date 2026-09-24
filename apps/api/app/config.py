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
    cors_origins: List[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    @model_validator(mode="after")
    def validate_secret_key(self):
        is_insecure = (
            not self.secret_key
            or self.secret_key == _INSECURE_DEFAULT_KEY
            or len(self.secret_key) < 32
        )
        if is_insecure:
            if self.environment == "production":
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            else:
                logging.getLogger("config").warning(
                    "\u26a0\ufe0f  SECRET_KEY is using the insecure default. "
                    "Set SECRET_KEY in your .env file before deploying to production."
                )
        return self


    # Database
    database_url: str
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
    admin_pin: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    allowed_email: str = ""
    admin_totp_secret: str = ""

    # IPO Data Sources
    ipoalerts_api_key: str = ""  # Free key from ipoalerts.in — sign up at https://ipoalerts.in

    # NSE compliance
    static_ip: str = ""

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
