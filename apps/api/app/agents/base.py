import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.setting import SystemSetting
from app.utils.security import decrypt_credential

logger = logging.getLogger("agent.base")


def get_default_model_for_provider(provider: str) -> str:
    p = (provider or "").lower()
    if p == "gemini":
        return "gemini-1.5-flash"
    elif p == "anthropic":
        return "claude-3-5-sonnet-20241022"
    elif p == "openai":
        return "gpt-4o-mini"
    return "openai/gpt-oss-120b"


class BaseAgent:
    """
    Abstract Base Class for autonomous agents in Kapitl.
    Manages multi-provider LLM execution (Groq, Gemini, Claude),
    context preparation, tool bindings, and structured JSON parsing.
    """

    def __init__(self, name: str, role: str, goal: str, backstory: str):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self.logger = logging.getLogger(f"agent.{name.lower().replace(' ', '_')}")

    async def get_ai_config(self, db: AsyncSession) -> Dict[str, str]:
        """Fetch active AI configuration (provider, model, API key) from DB or env."""
        stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
        res = await db.execute(stmt)
        row = res.scalar_one_or_none()
        prefs = row.value if row else {}

        provider = prefs.get("ai_provider") or settings.default_ai_provider or "groq"
        raw_model = prefs.get("ai_model") or settings.default_ai_model or ""
        model = raw_model if raw_model else get_default_model_for_provider(provider)

        if provider == "groq":
            raw_key = prefs.get("groq_api_key") or settings.groq_api_key or ""
        elif provider == "gemini":
            raw_key = prefs.get("gemini_api_key") or settings.gemini_api_key or ""
        elif provider == "anthropic":
            raw_key = prefs.get("anthropic_api_key") or settings.anthropic_api_key or ""
        else:
            raw_key = ""

        api_key = decrypt_credential(raw_key) if raw_key else ""

        return {
            "provider": provider.lower(),
            "model": model,
            "api_key": api_key,
        }

    async def call_llm(
        self,
        system_instruction: str,
        user_prompt: str,
        ai_cfg: Dict[str, str],
    ) -> Optional[Dict[str, Any]]:
        """Invokes the configured LLM with system instructions and user prompt expecting JSON."""
        provider = ai_cfg.get("provider", "groq")
        raw_model = ai_cfg.get("model", "")
        model = raw_model if raw_model else get_default_model_for_provider(provider)
        api_key = ai_cfg.get("api_key", "")

        if not api_key:
            self.logger.error(f"AI analysis unavailable — no API key configured for provider '{provider}'.")
            return {
                "error": f"AI analysis unavailable — no API key configured for {provider}",
                "analysis_failed": True,
            }

        full_system = f"{self.backstory}\n\nRole: {self.role}\nGoal: {self.goal}\n\n{system_instruction}"

        try:
            if provider == "groq":
                from groq import AsyncGroq
                client = AsyncGroq(api_key=api_key)
                response = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": full_system},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                text = response.choices[0].message.content
                return json.loads(text)

            elif provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model_obj = genai.GenerativeModel(
                    model or "gemini-1.5-flash",
                    generation_config={"response_mime_type": "application/json"},
                )
                response = await model_obj.generate_content_async(
                    f"{full_system}\n\n{user_prompt}"
                )
                return json.loads(response.text)

            elif provider == "anthropic":
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=api_key)
                response = await client.messages.create(
                    model=model or "claude-3-5-haiku-20241022",
                    max_tokens=2000,
                    system=full_system,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                return json.loads(response.content[0].text)

        except Exception as e:
            self.logger.error(f"Execution failure on {provider} ({model}): {e}")
            return {
                "error": f"AI analysis unavailable — execution failed on {provider}: {e}",
                "analysis_failed": True,
            }
