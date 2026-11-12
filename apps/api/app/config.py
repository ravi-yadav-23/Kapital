from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import List, Any
import json
import logging
import os
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
    # Used ONLY to authenticate external scheduler webhooks hitting /api/cron/*.
    # Deliberately separate from SECRET_KEY / MASTER_API_KEY.
    cron_secret: str = ""

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
        import secrets

        val_sec = (self.secret_key or "").strip()
        val_pin = (self.admin_pin or "").strip()
        is_production = self.environment.lower() in ("production", "prod")
        is_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

        # Fail closed: a serverless runtime is always internet-facing. If ENVIRONMENT was forgotten it
        # would default to "development" and sign JWTs with the public dev key from this repo.
        if is_serverless and not is_production:
            logger.warning(
                "[SECURITY] Serverless runtime detected with ENVIRONMENT=%r. Treating as 'production'. "
                "Set ENVIRONMENT=production explicitly in the project settings.",
                self.environment,
            )
            self.environment = "production"
            is_production = True

        # --- Security configuration & fail-safe defaults ---
        if is_production:
            if is_serverless:
                # On serverless platforms (e.g. Vercel / Lambda), fail safe if environment variables are not yet injected:
                if not val_sec or val_sec == _INSECURE_DEFAULT_KEY or len(val_sec) < 32:
                    logger.warning(
                        "[SECURITY] Serverless: SECRET_KEY was missing or insecure. "
                        "Auto-generating an ephemeral 256-bit key. Configure SECRET_KEY in environment variables."
                    )
                    self.secret_key = secrets.token_urlsafe(32)

                if not val_pin or val_pin in ["1234", "0000", "1111", "123456", "000000", "111111"] or len(val_pin) < 6:
                    logger.warning(
                        "[SECURITY] Serverless: ADMIN_PIN is trivial or under 6 characters ('%s'). "
                        "Configure a strong ADMIN_PIN in environment variables for administrative operations.",
                        val_pin or "(empty)",
                    )

                db_url = (self.database_url or "").strip().lower()
                if not db_url.startswith("postgresql") and not db_url.startswith("postgres"):
                    logger.warning(
                        "[CONFIG] Serverless: DATABASE_URL is not PostgreSQL (%s). "
                        "Using local/ephemeral SQLite storage on /tmp.",
                        self.database_url,
                    )
            else:
                # Dedicated production / CI environment: enforce strict production security guarantees
                if not val_sec or val_sec == _INSECURE_DEFAULT_KEY:
                    raise ValueError(
                        "In production, SECRET_KEY must be set to a strong, private secret (cannot be empty or default)."
                    )
                if len(val_sec) < 32:
                    raise ValueError("In production, SECRET_KEY must be at least 32 characters.")

                if not val_pin:
                    raise ValueError("In production, ADMIN_PIN must be explicitly set.")
                if val_pin in ["1234", "0000", "1111", "123456", "000000", "111111"]:
                    raise ValueError("In production, ADMIN_PIN cannot be a trivial or default PIN.")
                if len(val_pin) < 6:
                    raise ValueError("In production, ADMIN_PIN must be at least 6 digits/characters.")

                db_url = (self.database_url or "").strip().lower()
                if not db_url.startswith("postgresql") and not db_url.startswith("postgres"):
                    raise ValueError(
                        "In production, DATABASE_URL must be a managed PostgreSQL connection "
                        "(e.g. postgresql+asyncpg://...). SQLite is forbidden in production to prevent data loss."
                    )

            # ADMIN_TOTP_SECRET handling:
            # On serverless platforms (e.g. Vercel), if ADMIN_TOTP_SECRET is not yet configured in project env,
            # derive a deterministic stable secret from SECRET_KEY so cold starts don't crash or re-enroll.
            if is_serverless:
                if not (self.admin_totp_secret or "").strip():
                    import base64, hashlib
                    # Deterministically derive 32-character base32 secret from SECRET_KEY
                    derived_b32 = base64.b32encode(hashlib.sha256((self.secret_key + "_totp_salt").encode()).digest()[:20]).decode()
                    self.admin_totp_secret = derived_b32
                    logger.warning(
                        "[SECURITY] Serverless: ADMIN_TOTP_SECRET was not provided in environment variables. "
                        "Derived deterministic fallback secret from SECRET_KEY to prevent cold-start lockout. "
                        "Set ADMIN_TOTP_SECRET in Vercel project settings for dedicated 2FA isolation."
                    )
            else:
                # Dedicated production / CI environment: enforce strict production security guarantees
                if not (self.admin_totp_secret or "").strip():
                    raise ValueError(
                        "In production, ADMIN_TOTP_SECRET must be set to a stable, private secret. "
                        "Without it the TOTP secret is regenerated on every cold start and admin "
                        "2FA becomes unusable."
                    )

            # Auto-populate separated keys if not explicitly provided
            if not self.jwt_secret_key:
                self.jwt_secret_key = self.secret_key
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

    # Real IPO bids via Angel One stay OFF until the IPO-apply endpoint/payload is verified
    # against broker documentation. Demo/test clients are unaffected.
    enable_live_ipo_apply: bool = False

    # IPO Data Sources (each can be switched off without a code change)
    source_ipoalerts_enabled: bool = True
    source_groww_enabled: bool = True
    source_ipowatch_enabled: bool = True
    ipoalerts_plan: str = "free"          # "free": open issues only, 1 per request, 25 requests/day
    ipoalerts_daily_budget: int = 20      # self-imposed cap on the free plan (keeps 5 spare)
    ipoalerts_api_key: str = ""  # Free key from ipoalerts.in — sign up at https://ipoalerts.in

    # NSE compliance
    static_ip: str = ""
    static_mac: str = os.environ.get("STATIC_MAC", "02:00:00:00:00:00")
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
