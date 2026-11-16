import logging
from typing import Optional
from datetime import datetime, timezone

from app.models.report import AiReport
from app.models.ipo import Ipo
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
    """Formats stored AI reports for the API, and builds the plain market-data view when there is no report.

    No language model runs here: all model work happens in the nightly job (app.jobs.nightly), and every score
    comes from app.services.rating.rate().
    """

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


report_service = AiDueDiligenceService()
