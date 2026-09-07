from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    app_name: str = "Antigravity API"
    environment: str = "development"
    secret_key: str
    cors_origins: List[str] = ["http://localhost:3000"]

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
    default_ai_model: str = "llama-3.3-70b-versatile"

    # NSE compliance
    static_ip: str = ""

    class Config:
        env_file = ".env"

    @property
    def angel_accounts(self) -> List[dict]:
        return json.loads(self.angel_accounts_json)


settings = Settings()
