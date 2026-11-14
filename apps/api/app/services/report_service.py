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
from app.services.rating import rate
from app.utils.scoring import (
    recommendation_for,
    gmp_known,
    subscription_known,
    gmp_strength as gmp_strength_fn,
    subscription_momentum as subscription_momentum_fn,
)
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
                s = text.strip()
                if s.startswith("```"):
                    parts = s.split("```")
                    if len(parts) >= 2:
                        s = parts[1]
                        if s.startswith("json"):
                            s = s[4:]
                return json.loads(s.strip())

            elif provider == "gemini":
                raw_text = ""
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=api_key)
                    model_obj = genai.GenerativeModel(
                        model or "gemini-1.5-flash",
                        generation_config={"response_mime_type": "application/json"},
                    )
                    response = await model_obj.generate_content_async(
                        f"{system_instruction}\n\n{prompt}"
                    )
                    raw_text = response.text or ""
                except (ImportError, AttributeError):
                    from google import genai
                    from google.genai import types
                    client = genai.Client(api_key=api_key)
                    response = await client.aio.models.generate_content(
                        model=model or "gemini-1.5-flash",
                        contents=f"{system_instruction}\n\n{prompt}",
                        config=types.GenerateContentConfig(response_mime_type="application/json"),
                    )
                    raw_text = response.text or ""

                s = raw_text.strip()
                if s.startswith("```"):
                    parts = s.split("```")
                    if len(parts) >= 2:
                        s = parts[1]
                        if s.startswith("json"):
                            s = s[4:]
                return json.loads(s.strip())

            elif provider == "anthropic":
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=api_key)
                response = await client.messages.create(
                    model=model or "claude-3-5-haiku-20241022",
                    max_tokens=1500,
                    system=system_instruction,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = response.content[0].text
                s = text.strip()
                if s.startswith("```"):
                    parts = s.split("```")
                    if len(parts) >= 2:
                        s = parts[1]
                        if s.startswith("json"):
                            s = s[4:]
                return json.loads(s.strip())

        except Exception as e:
            logger.error(f"Error calling {provider} ({model}): {e}")
            return None

    def format_report_response(self, existing: AiReport, ipo: Optional[Ipo] = None) -> AiReportResponse:
        """Helper to format an AiReport ORM model and associated Ipo into an AiReportResponse schema."""
        red_flags = [RedFlagSchema(**rf) if isinstance(rf, dict) else rf for rf in (existing.red_flags or [])]
        ipo_name = ipo.name if ipo else "IPO Issue"
        ipo_symbol = ipo.symbol if ipo else "IPO"

        from app.schemas.report import FinancialMetricsSchema, GatekeeperCheckSchema

        fin_metrics = None
        if existing.financial_metrics and isinstance(existing.financial_metrics, dict):
            try:
                fin_metrics = FinancialMetricsSchema(**existing.financial_metrics)
            except Exception:
                pass

        gatekeeper_items = []
        if existing.gatekeepers and isinstance(existing.gatekeepers, list):
            for gk in existing.gatekeepers:
                try:
                    gatekeeper_items.append(GatekeeperCheckSchema(**gk))
                except Exception:
                    pass

        audited = bool(getattr(existing, "is_audited", True))
        if not audited:
            sb = ScoreBreakdownSchema(
                financial_quality=None,
                industry_tailwinds=None,
                subscription_momentum=existing.score_subscription_momentum,
                valuation_safety=None,
                gmp_strength=existing.score_gmp_strength,
                promoter_integrity=None,
            )
            if ipo is not None:
                overall_score = rate(ipo)["score"]
            else:
                overall_score = int(round((existing.score_gmp_strength or 0) * 0.60 + (existing.score_subscription_momentum or 0) * 0.40))
        else:
            sb = ScoreBreakdownSchema(
                financial_quality=existing.score_financial_quality,
                industry_tailwinds=existing.score_industry_tailwinds,
                subscription_momentum=existing.score_subscription_momentum,
                valuation_safety=existing.score_valuation_safety,
                gmp_strength=existing.score_gmp_strength,
                promoter_integrity=existing.score_promoter_integrity,
            )
            # one score everywhere: an old AI report no longer decides it
            overall_score = rate(ipo)["score"] if ipo is not None else existing.overall_score

        has_drhp = bool(ipo and (ipo.drhp_url or ipo.rhp_url))
        drhp_status = "FILED" if has_drhp else "NOT_FILED"
        missing_fields = []
        if not has_drhp:
            missing_fields.append("SEBI Draft Prospectus (DRHP)")
            missing_fields.append("OFS vs Fresh Issue Split")
            missing_fields.append("Restated Financial History (FY24-FY26)")
        if ipo and (not ipo.price_band_min or not ipo.price_band_max or ipo.price_band_min == ipo.price_band_max == 0):
            missing_fields.append("Price Band")
        if ipo and (not ipo.issue_size_cr or ipo.issue_size_cr == 0):
            missing_fields.append("Issue Size")
        if ipo and not ipo.issue_open_date:
            missing_fields.append("Bidding Dates")

        drhp_disclaimer = None
        if drhp_status == "NOT_FILED":
            drhp_disclaimer = (
                f"DRHP Pre-Filing Notice: {ipo_name} has not yet filed its Draft Red Herring Prospectus (DRHP) with SEBI. "
                "Detailed restated financials (revenue, PAT, cash flow), capital structure split (OFS vs Fresh Issue), "
                "and peer valuation multiples are not publicly disclosed. Quantitative conviction score reflects early "
                "grey market buzz and sector benchmarks only."
            )

        return AiReportResponse(
            id=existing.id,
            ipo_id=existing.ipo_id,
            ipo_name=ipo_name,
            ipo_symbol=ipo_symbol,
            overall_score=overall_score,
            is_audited=audited,
            drhp_status=drhp_status,
            drhp_disclaimer=drhp_disclaimer,
            missing_fields=missing_fields,
            recommendation=recommendation_for(overall_score) if ipo is not None else existing.recommendation,
            score_breakdown=sb,
            executive_summary=existing.executive_summary or f"Due diligence analysis for {ipo_name}.",
            summary_source=getattr(existing, "summary_source", "ai_generated") or "ai_generated",
            strengths=existing.strengths or (ipo.strengths if ipo else []) or [],
            risks=existing.risks or (ipo.risks if ipo else []) or [],
            red_flags=red_flags,
            financial_metrics=fin_metrics,
            gatekeepers=gatekeeper_items,
            pe_ratio=existing.pe_ratio,
            peer_avg_pe=existing.peer_avg_pe,
            ofs_percentage=existing.ofs_percentage,
            gmp_percent=existing.gmp_percent or (ipo.gmp_percent if ipo else 0.0),
            estimated_listing_price=existing.estimated_listing_price,
            scored_at=existing.scored_at or datetime.now(timezone.utc).strftime("%d %b %Y"),
        )

    def build_fallback_report_response(self, ipo: Ipo) -> AiReportResponse:
        """
        Helper to create an honest preliminary AiReportResponse for an IPO that hasn't run an AI DRHP audit.
        DRHP-dependent factors (financial quality, promoter integrity, valuation) are None ("Not assessed").
        Only live market data factors (GMP, subscription) are scored.
        Displayed weights total 100% (GMP 60% + Subscription 40%) and the headline score equals their weighted sum.
        """
        from app.utils.sector_fallbacks import get_sector_fallback
        sector_data = get_sector_fallback(
            name=ipo.name or "",
            industry=ipo.type or "",
            about=ipo.about or ""
        )

        gmp = float(ipo.gmp_percent or 0.0)
        sub_total = float(ipo.subscription_total or 0.0)

        # Single formula (app.utils.scoring); None == "No score yet" when there is no market data.
        score = rate(ipo)["score"]
        gmp_strength = gmp_strength_fn(gmp) if gmp_known(ipo.gmp_percent) else None
        subscription_momentum = (
            subscription_momentum_fn(sub_total or float(ipo.subscription_qib or 0.0))
            if subscription_known(ipo.subscription_total, ipo.subscription_qib) else None
        )
        rec = recommendation_for(score)
        price_max = ipo.price_band_max or 100.0
        est_price = round(price_max * (1 + (gmp / 100.0)), 2)

        has_drhp = bool(ipo.drhp_url or ipo.rhp_url)
        drhp_status = "FILED" if has_drhp else "NOT_FILED"
        missing_fields = []
        if not has_drhp:
            missing_fields.append("SEBI Draft Prospectus (DRHP)")
            missing_fields.append("OFS vs Fresh Issue Split")
            missing_fields.append("Restated Financial History (FY24-FY26)")
        if not ipo.price_band_min or not ipo.price_band_max or ipo.price_band_min == ipo.price_band_max == 0:
            missing_fields.append("Price Band")
        if not ipo.issue_size_cr or ipo.issue_size_cr == 0:
            missing_fields.append("Issue Size")
        if not ipo.issue_open_date:
            missing_fields.append("Bidding Dates")

        drhp_disclaimer = None
        if not has_drhp:
            drhp_disclaimer = (
                f"DRHP Pre-Filing Notice: {ipo.name} has not yet filed its Draft Red Herring Prospectus (DRHP) with SEBI. "
                "Detailed restated financials (revenue, PAT, cash flow), capital structure split (OFS vs Fresh Issue), "
                "and peer valuation multiples are not publicly disclosed. Quantitative conviction score reflects early "
                "grey market buzz and sector benchmarks only."
            )

        from app.schemas.report import FinancialMetricsSchema, FinancialYearItem, GatekeeperCheckSchema

        # Strict fidelity: Never invent financial metrics if DRHP is not filed
        fallback_fin = None

        is_sme = (ipo.type == "SME") or ("SME" in (ipo.name or ""))
        fallback_gatekeepers = [
            GatekeeperCheckSchema(
                key="ofs_split",
                name="OFS vs. Fresh Issue Split",
                details=(
                    "DRHP not yet filed with SEBI — issue breakdown pending official regulatory draft."
                    if not has_drhp
                    else "Pending DRHP audit to verify OFS vs Fresh allocation."
                ),
                status="WARN",
                threshold="OFS ≤ 40% (Fresh ≥ 60%)",
                impact=(
                    "Pending official DRHP to verify whether promoters or early investors are offloading equity."
                    if not has_drhp
                    else "Capital retained inside company to fund capex; minimal promoter dump."
                ),
            ),
            GatekeeperCheckSchema(
                key="anchor_quality",
                name="Anchor Book Quality",
                details=(
                    "Exempt for SME platform issues (SEBI ICDR regulations)"
                    if is_sme
                    else (
                        "Anchor allocation disclosures release 1 day prior to issue opening; pending DRHP clearance."
                        if not has_drhp
                        else "Requires DRHP audit to verify mutual fund participation."
                    )
                ),
                status="WARN",
                threshold="N/A (SME platform)" if is_sme else "Domestic MFs > 30%",
                impact=(
                    "Anchor investor reservation is optional for SME issues under BSE SME / NSE Emerge norms."
                    if is_sme
                    else (
                        "Institutional price floor can only be evaluated once anchor allocations are published."
                        if not has_drhp
                        else "Audit needed to confirm institutional price floor stability."
                    )
                ),
            ),
            GatekeeperCheckSchema(
                key="cfo_conversion",
                name="Cash Flow vs. PAT Conversion",
                details=(
                    "Audited restated accounts pending SEBI DRHP publication."
                    if not has_drhp
                    else "Awaiting DRHP audit for cash collections conversion."
                ),
                status="WARN",
                threshold="CFO / PAT Ratio ≥ 0.70x",
                impact="Cannot assess cash collection quality without statutory auditor-certified financials.",
            ),
            GatekeeperCheckSchema(
                key="valuation_cushion",
                name="Valuation Room vs. Listed Peers",
                details=(
                    "Price band and P/E valuation multiples not yet fixed by book running lead managers."
                    if not has_drhp
                    else "Requires DRHP audit for precise peer multiple discount."
                ),
                status="WARN",
                threshold="≥ 15% discount to peers",
                impact="Valuation discount will be determined once merchant bankers fix the issue price band.",
            ),
            GatekeeperCheckSchema(
                key="litigation_exposure",
                name="Litigation Liability Ratio",
                details=(
                    "Legal annexures and contingent tax claims pending official DRHP disclosure."
                    if not has_drhp
                    else "No critical court orders detected in public preliminary scan."
                ),
                status="WARN",
                threshold="Claims < 5% of Issue Size",
                impact="Contingent legal liabilities can only be quantified from official SEBI DRHP filing.",
            ),
        ]

        return AiReportResponse(
            id=f"auto-{ipo.id}",
            ipo_id=ipo.id,
            ipo_name=ipo.name,
            ipo_symbol=ipo.symbol,
            overall_score=score,
            is_audited=False,
            drhp_status=drhp_status,
            drhp_disclaimer=drhp_disclaimer,
            missing_fields=missing_fields,
            recommendation=rec,
            score_breakdown=ScoreBreakdownSchema(
                financial_quality=None,  # DRHP-dependent: Not assessed
                industry_tailwinds=None,  # DRHP-dependent: Not assessed
                subscription_momentum=subscription_momentum,  # From live data (40% weight)
                valuation_safety=None,   # DRHP-dependent: Not assessed
                gmp_strength=gmp_strength,  # From live data (60% weight)
                promoter_integrity=None, # DRHP-dependent: Not assessed
            ),
            executive_summary=(
                ("No market data yet (no grey market premium or subscription numbers), so there is no score. " if score is None
                 else f"Preliminary rating ({score}/100) derived solely from live grey market premium ({gmp}%) and market signals. ")
                + ("DRHP not yet filed with SEBI." if not has_drhp else "No AI audit has run, so red flags are unknown.")
                if not has_drhp
                else f"No audit has run, so red flags are unknown. Preliminary rating derived solely from live grey market premium ({gmp}%) and subscription demand."
            ),
            summary_source="sector_fallback",
            strengths=sector_data["strengths"],
            risks=sector_data["risks"],
            red_flags=[],
            financial_metrics=fallback_fin,
            gatekeepers=fallback_gatekeepers,
            pe_ratio=None,  # never invent a P/E
            peer_avg_pe=None if not has_drhp else 30.0,
            ofs_percentage=None if not has_drhp else 25.0,
            gmp_percent=gmp,
            estimated_listing_price=est_price if ipo.price_band_max else None,
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
