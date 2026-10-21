import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.report import AiReport
from app.models.ipo import Ipo
from app.models.setting import SystemSetting
from app.schemas.report import AiReportResponse, ScoreBreakdownSchema, RedFlagSchema

logger = logging.getLogger("report_service")


class AiDueDiligenceService:
    """
    Orchestrates real-time AI due diligence using dynamically selectable LLM providers:
    - Groq (LLaMA 3.3 70B / LLaMA 3.1 8B)
    - Google Gemini (Gemini 1.5 Flash / Pro)
    - Anthropic Claude (Claude 3.5 Haiku / Sonnet)
    Persists audit findings, 6-dimension scores, and red flags into PostgreSQL.
    """

    @staticmethod
    def compute_weighted_score(
        financial_quality: int,
        industry_tailwinds: int,
        subscription_momentum: int,
        valuation_safety: int,
        gmp_strength: int,
        promoter_integrity: int,
        penalties: int = 0,
    ) -> int:
        raw_score = (
            (financial_quality * 0.25)
            + (valuation_safety * 0.20)
            + (gmp_strength * 0.20)
            + (promoter_integrity * 0.15)
            + (industry_tailwinds * 0.10)
            + (subscription_momentum * 0.10)
            - penalties
        )
        return max(0, min(100, int(round(raw_score))))

    @staticmethod
    def get_recommendation(score: int) -> str:
        if score >= 80:
            return "STRONG_APPLY"
        elif score >= 60:
            return "MODERATE_APPLY"
        elif score >= 45:
            return "WATCH"
        else:
            return "AVOID"

    async def _get_active_ai_config(self, db: AsyncSession) -> Dict[str, str]:
        """Fetch selected AI provider, model, and active API key from PostgreSQL settings or .env."""
        stmt = select(SystemSetting).where(SystemSetting.key == "app_preferences")
        res = await db.execute(stmt)
        row = res.scalar_one_or_none()
        prefs = row.value if row else {}

        from app.agents.base import get_default_model_for_provider
        provider = prefs.get("ai_provider") or settings.default_ai_provider or "groq"
        raw_model = prefs.get("ai_model") or settings.default_ai_model or ""
        if not raw_model or "gpt-oss-120b" in raw_model:
            model = get_default_model_for_provider(provider)
        else:
            model = raw_model

        # Determine active API key
        if provider == "groq":
            api_key = prefs.get("groq_api_key") or settings.groq_api_key or ""
        elif provider == "gemini":
            api_key = prefs.get("gemini_api_key") or settings.gemini_api_key or ""
        elif provider == "anthropic":
            api_key = prefs.get("anthropic_api_key") or settings.anthropic_api_key or ""
        else:
            api_key = ""

        return {
            "provider": provider.lower(),
            "model": model,
            "api_key": api_key,
        }

    async def _call_llm(self, prompt: str, ai_cfg: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Call Groq, Gemini, or Claude with structured JSON output."""
        provider = ai_cfg["provider"]
        model = ai_cfg["model"]
        api_key = ai_cfg["api_key"]

        if not api_key:
            logger.info(f"No API key provided for {provider}. Using algorithmic heuristic fallback.")
            return None

        system_instruction = (
            "You are a seasoned institutional Indian IPO research analyst. "
            "Analyze the given IPO data and return ONLY a valid JSON object with the requested keys."
        )

        try:
            if provider == "groq":
                from groq import AsyncGroq
                client = AsyncGroq(api_key=api_key)
                response = await client.chat.completions.create(
                    model=model or "llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt},
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
                    f"{system_instruction}\n\n{prompt}"
                )
                return json.loads(response.text)

            elif provider == "anthropic":
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=api_key)
                response = await client.messages.create(
                    model=model or "claude-3-5-haiku-20241022",
                    max_tokens=1500,
                    system=system_instruction,
                    messages=[{"role": "user", "content": prompt}],
                )
                return json.loads(response.content[0].text)

        except Exception as e:
            logger.error(f"Error calling {provider} ({model}): {e}")
            return None

    def format_report_response(self, existing: AiReport, ipo: Optional[Ipo] = None) -> AiReportResponse:
        """Helper to format an AiReport ORM model and associated Ipo into an AiReportResponse schema."""
        red_flags = [RedFlagSchema(**rf) if isinstance(rf, dict) else rf for rf in (existing.red_flags or [])]
        ipo_name = ipo.name if ipo else "IPO Issue"
        ipo_symbol = ipo.symbol if ipo else "IPO"
        return AiReportResponse(
            id=existing.id,
            ipo_id=existing.ipo_id,
            ipo_name=ipo_name,
            ipo_symbol=ipo_symbol,
            overall_score=existing.overall_score,
            recommendation=existing.recommendation,
            score_breakdown=ScoreBreakdownSchema(
                financial_quality=existing.score_financial_quality,
                industry_tailwinds=existing.score_industry_tailwinds,
                subscription_momentum=existing.score_subscription_momentum,
                valuation_safety=existing.score_valuation_safety,
                gmp_strength=existing.score_gmp_strength,
                promoter_integrity=existing.score_promoter_integrity,
            ),
            executive_summary=existing.executive_summary or f"Due diligence analysis for {ipo_name}.",
            summary_source=getattr(existing, "summary_source", "ai_generated") or "ai_generated",
            strengths=existing.strengths or (ipo.strengths if ipo else []) or [],
            risks=existing.risks or (ipo.risks if ipo else []) or [],
            red_flags=red_flags,
            gmp_percent=existing.gmp_percent or (ipo.gmp_percent if ipo else 0.0),
            estimated_listing_price=existing.estimated_listing_price,
            scored_at=existing.scored_at or datetime.now(timezone.utc).strftime("%d %b %Y"),
        )

    def build_fallback_report_response(self, ipo: Ipo) -> AiReportResponse:
        """Helper to create an instant sector-aware AiReportResponse for an IPO that hasn't generated a full multi-agent report yet."""
        from app.utils.sector_fallbacks import get_sector_fallback
        sector_data = get_sector_fallback(
            name=ipo.name or "",
            industry=ipo.type or "",
            about=ipo.about or ""
        )

        score = ipo.score or 50
        rec = ipo.recommendation or self.get_recommendation(score)
        gmp = ipo.gmp_percent or 0.0
        price_max = ipo.price_band_max or 100.0
        est_price = round(price_max * (1 + (gmp / 100.0)), 2)

        return AiReportResponse(
            id=f"auto-{ipo.id}",
            ipo_id=ipo.id,
            ipo_name=ipo.name,
            ipo_symbol=ipo.symbol,
            overall_score=score,
            recommendation=rec,
            score_breakdown=ScoreBreakdownSchema(
                financial_quality=min(100, max(10, score + 5)),
                industry_tailwinds=min(100, max(10, score + 2)),
                subscription_momentum=min(100, max(10, int(gmp * 1.2))),
                valuation_safety=min(100, max(10, score - 5)),
                gmp_strength=min(100, max(10, int(gmp * 1.5))),
                promoter_integrity=score,
            ),
            executive_summary=f"Sector-based estimate — AI analysis not run. Preliminary assessment for {ipo.name} ({ipo.type}). Indicative GMP stands at {gmp}% with preliminary score of {score}/100.",
            summary_source="sector_fallback",
            strengths=sector_data["strengths"],
            risks=sector_data["risks"],
            red_flags=[],
            gmp_percent=gmp,
            estimated_listing_price=est_price,
            scored_at=datetime.now(timezone.utc).strftime("%d %b %Y"),
        )

    async def get_or_generate_report(self, db: AsyncSession, ipo: Ipo, force_refresh: bool = False) -> AiReportResponse:
        """Fetch existing report from DB or generate a fresh analysis via the configured AI model."""
        if not force_refresh:
            stmt = select(AiReport).where(AiReport.ipo_id == ipo.id)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                return self.format_report_response(existing, ipo)

        # Delegate to autonomous multi-agent orchestrator (Analysis, News, Allocation agents)
        from app.agents.orchestrator import orchestrator
        return await orchestrator.run_full_due_diligence(db, ipo.id)


report_service = AiDueDiligenceService()
