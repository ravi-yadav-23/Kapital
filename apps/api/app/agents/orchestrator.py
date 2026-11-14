import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ipo import Ipo
from app.models.report import AiReport
from app.schemas.report import AiReportResponse, ScoreBreakdownSchema, RedFlagSchema
from app.agents.analysis_agent import analysis_agent
from app.agents.news_agent import news_agent
from app.agents.allocation_agent import allocation_agent
from app.agents.tools import get_ipo_full_profile
from app.utils.scoring import (
    gmp_known, subscription_known, gmp_strength as _gmp_strength,
    subscription_momentum as _sub_momentum,
)
from app.services.rating import rate

logger = logging.getLogger("agent.orchestrator")


class IpoDueDiligenceOrchestrator:
    """
    Autonomous Multi-Agent Orchestrator.
    Executes AnalysisAgent, NewsAgent, and AllocationAgent concurrently,
    synthesizes forensic findings, compiles 6-dimension scores, and persists
    the official AiReport dossier to PostgreSQL.
    """

    @staticmethod
    def compute_weighted_score(
        financial_quality: Optional[int],
        industry_tailwinds: Optional[int],
        subscription_momentum: Optional[int],
        valuation_safety: Optional[int],
        gmp_strength: Optional[int],
        promoter_integrity: Optional[int],
        penalties: int = 0,
    ) -> int:
        """Weighted score over the components that were actually assessed.

        A component that is None ("not assessed") is left out and the remaining weights are
        renormalised, so a missing assessment can never silently count as an average score.
        """
        components = [
            (financial_quality, 0.25),
            (valuation_safety, 0.20),
            (gmp_strength, 0.20),
            (promoter_integrity, 0.15),
            (industry_tailwinds, 0.10),
            (subscription_momentum, 0.10),
        ]
        present = [(v, w) for v, w in components if v is not None]
        total_weight = sum(w for _, w in present)
        raw_score = (sum(v * w for v, w in present) / total_weight if total_weight else 0.0) - penalties
        return max(1, min(100, int(round(raw_score))))

    @staticmethod
    def get_recommendation(score: int) -> str:
        if score >= 80:
            return "STRONG_APPLY"
        elif score >= 62:
            return "MODERATE_APPLY"
        elif score >= 45:
            return "WATCH"
        else:
            return "AVOID"

    async def run_full_due_diligence(self, db: AsyncSession, ipo_id: str) -> AiReportResponse:
        """Runs end-to-end multi-agent workflow for a given IPO issue."""
        ipo = await get_ipo_full_profile(db, ipo_id)
        if not ipo:
            raise ValueError(f"IPO '{ipo_id}' not found.")

        logger.info(f"Initiating multi-agent due diligence for {ipo['symbol']}...")

        # Concurrently execute Analysis and News agents with a 28-second hard timeout
        analysis_task = analysis_agent.analyze(db, ipo_id)
        news_task = news_agent.analyze(db, ipo_id)
        try:
            analysis_res, news_res = await asyncio.wait_for(
                asyncio.gather(analysis_task, news_task),
                timeout=28.0,
            )
        except asyncio.TimeoutError:
            logger.error(f"Agent gather() timed out for {ipo.get('symbol')}")
            analysis_res = {"analysis_failed": True, "error": "LLM timeout"}
            news_res = {"analysis_failed": True, "error": "LLM timeout"}

        # Execute Allocation strategist with synthesized inputs
        allocation_res = await allocation_agent.strategize(db, ipo_id)

        def _safe_int(val: Any, default: int = 70) -> int:
            try:
                return int(float(val))
            except Exception:
                return default

        def _opt_score(val: Any) -> Optional[int]:
            """None / non-numeric means 'not assessed' - never replaced by a default number."""
            if val is None or isinstance(val, bool):
                return None
            try:
                return max(0, min(100, int(float(val))))
            except (TypeError, ValueError):
                return None

        # Extract dimension scores (None == not assessed)
        fin = _opt_score(analysis_res.get("financial_quality_score"))
        val = _opt_score(analysis_res.get("valuation_safety_score"))
        gov = _opt_score(news_res.get("promoter_integrity_score"))
        ind = _opt_score(news_res.get("industry_tailwinds_score"))
        # "Audited" means an AI assessment actually produced at least one score.
        has_model_scores = any(v is not None for v in (fin, val, gov, ind))

        gmp_pct = float(ipo.get("gmp_percent") or 0.0)
        qib_sub = float(ipo.get("subscription_qib") or 0.0)
        sub_total_in = float(ipo.get("subscription_total") or 0.0)
        # Same formulas as every other endpoint (app.utils.scoring); None == no market data.
        gmp_s = _gmp_strength(gmp_pct) if gmp_known(ipo.get("gmp_percent")) else None
        sub_m = _sub_momentum(sub_total_in or qib_sub) if subscription_known(sub_total_in, qib_sub) else None

        # Collect red flags
        all_red_flags = []
        for rf in analysis_res.get("accounting_red_flags", []):
            if isinstance(rf, dict):
                item = dict(rf)
                desc = item.get("description") or item.get("detail") or item.get("flag") or item.get("title") or "Accounting Risk Identified"
                sev = str(item.get("severity", "MEDIUM")).upper()
                pen = _safe_int(item.get("penalty_points") or item.get("penalty"), 10 if sev == "HIGH" else 5)
                item["title"] = item.get("title") or item.get("type") or "Accounting Risk"
                item["description"] = desc
                item["flag"] = desc
                item["severity"] = sev
                item["penalty_points"] = pen
                item["penalty"] = pen
                all_red_flags.append(item)
            else:
                desc = str(rf)
                all_red_flags.append({"title": desc, "flag": desc, "severity": "MEDIUM", "description": desc, "penalty_points": 5, "penalty": 5})

        for gf in news_res.get("governance_flags", []):
            if isinstance(gf, dict):
                item = dict(gf)
                desc = item.get("description") or item.get("detail") or item.get("flag") or item.get("title") or "Governance Flag Identified"
                sev = str(item.get("severity", "MEDIUM")).upper()
                pen = _safe_int(item.get("penalty_points") or item.get("penalty"), 10 if sev == "HIGH" else 5)
                item["title"] = item.get("title") or item.get("type") or "Governance Flag"
                item["description"] = desc
                item["flag"] = desc
                item["severity"] = sev
                item["penalty_points"] = pen
                item["penalty"] = pen
                all_red_flags.append(item)
            else:
                desc = str(gf)
                all_red_flags.append({"title": desc, "flag": desc, "severity": "MEDIUM", "description": desc, "penalty_points": 5, "penalty": 5})

        penalties = sum(rf.get("penalty_points", 0) for rf in all_red_flags)
        if has_model_scores:
            overall_score = self.compute_weighted_score(fin, ind, sub_m, val, gmp_s, gov, penalties)
        else:
            # Same preliminary formula the stored-report endpoint uses, so both always agree.
            overall_score = rate({**ipo, "subscription_qib": qib_sub, "subscription_total": sub_total_in})["score"]

        price_max = float(ipo.get("price_band_max") or 100.0)
        est_listing_price = round(price_max * (1 + (gmp_pct / 100.0)), 2)
        scored_at = datetime.now(timezone.utc).strftime("%d %b %Y")

        from app.utils.text_utils import clean_text, clean_text_list
        from app.utils.sector_fallbacks import get_sector_fallback

        sector_data = get_sector_fallback(
            name=ipo.get("name", ""),
            industry=ipo.get("type", ""),
            about=ipo.get("about", "")
        )

        has_drhp = bool(ipo.get("drhp_url") or ipo.get("rhp_url"))
        drhp_status = "FILED" if has_drhp else "NOT_FILED"

        missing_fields = []
        if not has_drhp:
            missing_fields.append("SEBI Draft Prospectus (DRHP)")
            missing_fields.append("OFS vs Fresh Issue Split")
            missing_fields.append("Restated Financial Statements")
        else:
            missing_fields.append("Prospectus figures (not parsed by Kapitl)")
        if not ipo.get("price_band_min") or not ipo.get("price_band_max"):
            missing_fields.append("Price Band")
        if not ipo.get("issue_size_cr"):
            missing_fields.append("Issue Size")
        if not ipo.get("issue_open_date"):
            missing_fields.append("Bidding Dates")

        drhp_disclaimer = None
        if has_drhp:
            drhp_disclaimer = (
                f"A prospectus is on file for {ipo.get('name')}, but Kapitl does not parse prospectus documents. "
                "Restated financials, OFS split, litigation and peer multiples are NOT assessed; "
                "scores reflect market signals and an AI reading of the listed highlights only."
            )
        else:
            drhp_disclaimer = (
                f"DRHP Pre-Filing Notice: {ipo.get('name')} has not yet filed its Draft Red Herring Prospectus (DRHP) with SEBI. "
                "Official restated financials (revenue, PAT, cash flow), capital structure split (OFS vs Fresh Issue), "
                "and peer valuation multiples are not available. Conviction score reflects early grey market buzz and sector benchmarks only."
            )

        # Fix 3: Check if AI analysis failed (e.g. no API key configured)
        is_analysis_failed = (
            analysis_res.get("analysis_failed", False)
            or news_res.get("analysis_failed", False)
        )  # allocation advice is advisory and never affects scoring

        if is_analysis_failed:
            # Return an HONEST preliminary response — never fabricate or mark as audited.
            # Score only from live market signals (GMP + subscription).
            preliminary_score = rate({**ipo, "subscription_qib": qib_sub, "subscription_total": sub_total_in})["score"]
            audit_reason = (
                analysis_res.get("error") or news_res.get("error") or "the AI analysis did not complete"
            )

            # Persist a minimal stub to DB so the UI shows "Audit Pending" on subsequent GETs
            # without re-triggering the full pipeline.
            score_txt = (
                f"Score ({preliminary_score}/100) is an indicative preliminary estimate from market signals."
                if preliminary_score is not None
                else "There is no score yet: no grey market premium or subscription numbers are available."
            )
            stub_summary = (
                f"DRHP not yet filed with SEBI. {score_txt}"
                if not has_drhp
                else f"AI audit not run. {score_txt}"
            )
            stub_scored_at = datetime.now(timezone.utc).strftime("%d %b %Y")

            stmt = select(AiReport).where(AiReport.ipo_id == ipo["id"])
            res = await db.execute(stmt)
            report_row = res.scalar_one_or_none()

            if report_row:
                # Only overwrite if the row is NOT already a fully audited report
                if not getattr(report_row, "is_audited", False):
                    report_row.overall_score = preliminary_score if preliminary_score is not None else 0  # placeholder, never displayed
                    report_row.recommendation = "PENDING"
                    report_row.executive_summary = stub_summary
                    report_row.summary_source = "preliminary_market_signals"
                    report_row.is_audited = False
                    report_row.red_flags = []
                    report_row.gatekeepers = []
                    report_row.financial_metrics = None
                    report_row.scored_at = stub_scored_at
            else:
                report_row = AiReport(
                    id=f"rep-{str(uuid.uuid4())[:8]}",
                    ipo_id=ipo["id"],
                    overall_score=preliminary_score if preliminary_score is not None else 0,  # placeholder, never displayed
                    recommendation="PENDING",
                    executive_summary=stub_summary,
                    summary_source="preliminary_market_signals",
                    is_audited=False,
                    red_flags=[],
                    gatekeepers=[],
                    financial_metrics=None,
                    scored_at=stub_scored_at,
                )
                db.add(report_row)

            await db.commit()

            return AiReportResponse(
                id=getattr(report_row, "id", f"rep-{ipo['id'][:8]}"),
                ipo_id=ipo["id"],
                ipo_name=ipo.get("name"),
                ipo_symbol=ipo.get("symbol"),
                overall_score=preliminary_score,
                is_audited=False,
                audit_state="PRELIMINARY",
                audit_note=(
                    "No AI analysis was produced: "
                    + ("no AI API key is configured." if "api key" in str(audit_reason).lower()
                       else "the AI call failed or timed out.")
                    + " Showing the preliminary market-signal view."
                ),
                drhp_status=drhp_status,
                drhp_disclaimer=drhp_disclaimer,
                missing_fields=missing_fields,
                recommendation="PENDING",
                executive_summary=stub_summary,
                summary_source="preliminary_market_signals",
                score_breakdown=ScoreBreakdownSchema(
                    financial_quality=None,
                    industry_tailwinds=None,
                    subscription_momentum=None,
                    valuation_safety=None,
                    gmp_strength=gmp_s,
                    promoter_integrity=None,
                ),
                strengths=[],
                risks=[],
                red_flags=[],
                financial_metrics=None,
                gatekeepers=[],
                pe_ratio=None,
                peer_avg_pe=None,
                ofs_percentage=None,
                gmp_percent=gmp_pct,
                estimated_listing_price=None,
                scored_at=stub_scored_at,
            )
        else:
            recommendation = self.get_recommendation(overall_score) if has_model_scores else "PENDING"
            analyst_verdict = clean_text(analysis_res.get("analyst_verdict", ""))
            sentiment_summary = clean_text(news_res.get("sentiment_summary", ""))

            # Fix 4: Dynamic executive summary based on analyst verdict and sentiment
            if len(analyst_verdict) > 50:
                summary_source = "ai_generated"
                if sentiment_summary:
                    summary_narrative = f"{analyst_verdict} {sentiment_summary}"
                else:
                    summary_narrative = analyst_verdict
            elif sentiment_summary and len(sentiment_summary) > 50:
                summary_source = "ai_generated"
                summary_narrative = sentiment_summary
            else:
                summary_source = "template_fallback"
                fin_txt = f"{fin}/100" if fin is not None else "not assessed"
                val_txt = f"{val}/100" if val is not None else "not assessed"
                summary_narrative = (
                    f"{ipo['name']} has an indicative score of {overall_score}/100 ('{recommendation}'). "
                    f"Financial quality: {fin_txt}; valuation safety: {val_txt}. "
                    f"Market sentiment is {news_res.get('market_buzz_rating', 'MODERATE')} with current GMP at {gmp_pct}%. "
                    f"Optimal allocation strategy: {allocation_res.get('recommended_primary_category', 'RETAIL')} bidding."
                )

        summary_narrative = clean_text(summary_narrative)

        # Fix 5: Sector-aware heuristic fallback for strengths and risks
        raw_strengths = analysis_res.get("strengths_summary") or ipo.get("strengths") or sector_data["strengths"]
        raw_risks = analysis_res.get("concerns_summary") or ipo.get("risks") or sector_data["risks"]

        strengths = clean_text_list(raw_strengths)
        risks = clean_text_list(raw_risks)

        # 1. Financial Metrics Extraction & Synthesis (Strict Fidelity - No Fabrications)
        issue_size_cr = float(ipo.get("issue_size_cr") or 100.0)

        raw_rev_hist = analysis_res.get("revenue_history")
        raw_pat_hist = analysis_res.get("pat_history")
        raw_cfo_hist = analysis_res.get("cfo_history")

        # The agents are given NO financial statements, so any series, growth figure or ratio the
        # model returns is recall/invention, not data. Only accept them if the inputs carried them.
        inputs_have_financials = bool(ipo.get("financial_statements"))
        if not inputs_have_financials:
            raw_rev_hist = raw_pat_hist = raw_cfo_hist = None
            analysis_res = {
                **analysis_res,
                "revenue_growth_yoy": None,
                "pat_growth_yoy": None,
                "cfo_to_pat_ratio": None,
                "growth_demand_verdict": None,
            }

        # Validate that historical figures are legitimately provided lists of items
        has_real_rev = isinstance(raw_rev_hist, list) and len(raw_rev_hist) > 0 and all(isinstance(x, dict) and "amount_cr" in x for x in raw_rev_hist)
        has_real_pat = isinstance(raw_pat_hist, list) and len(raw_pat_hist) > 0 and all(isinstance(x, dict) and "amount_cr" in x for x in raw_pat_hist)
        has_real_cfo = isinstance(raw_cfo_hist, list) and len(raw_cfo_hist) > 0 and all(isinstance(x, dict) and "amount_cr" in x for x in raw_cfo_hist)

        rev_hist = raw_rev_hist if has_real_rev else []
        pat_hist = raw_pat_hist if has_real_pat else []
        cfo_hist = raw_cfo_hist if has_real_cfo else []

        # Determine data sufficiency:
        if inputs_have_financials and has_real_rev and has_real_pat and len(rev_hist) >= 3:
            data_sufficiency = "full"
        elif ipo.get("price_band_max") or ipo.get("issue_size") or ipo.get("gmp_percent"):
            data_sufficiency = "partial"
        else:
            data_sufficiency = "none"

        # Prepend honest disclosure tag if inputs are limited
        if data_sufficiency != "full" and not summary_narrative.startswith("[AI summary from limited inputs]"):
            summary_narrative = f"[AI summary from limited inputs] {summary_narrative}"

        rev_growth_yoy = analysis_res.get("revenue_growth_yoy")
        if not rev_growth_yoy and len(rev_hist) >= 2:
            try:
                rev_yoy_val = ((rev_hist[-1]["amount_cr"] - rev_hist[-2]["amount_cr"]) / rev_hist[-2]["amount_cr"]) * 100
                rev_growth_yoy = f"+{rev_yoy_val:.1f}% YoY" if rev_yoy_val >= 0 else f"{rev_yoy_val:.1f}% YoY"
            except Exception:
                rev_growth_yoy = None

        pat_growth_yoy = analysis_res.get("pat_growth_yoy")
        if not pat_growth_yoy and len(pat_hist) >= 2:
            try:
                pat_yoy_val = ((pat_hist[-1]["amount_cr"] - pat_hist[-2]["amount_cr"]) / pat_hist[-2]["amount_cr"]) * 100
                pat_growth_yoy = f"+{pat_yoy_val:.1f}% YoY" if pat_yoy_val >= 0 else f"{pat_yoy_val:.1f}% YoY"
            except Exception:
                pat_growth_yoy = None

        cfo_to_pat = None
        if "cfo_to_pat_ratio" in analysis_res and analysis_res["cfo_to_pat_ratio"] is not None:
            try:
                cfo_to_pat = round(float(analysis_res["cfo_to_pat_ratio"]), 2)
            except Exception:
                pass
        elif pat_hist and cfo_hist and float(pat_hist[-1]["amount_cr"]) > 0:
            cfo_to_pat = round(float(cfo_hist[-1]["amount_cr"]) / float(pat_hist[-1]["amount_cr"]), 2)

        demand_verdict = analysis_res.get("growth_demand_verdict")
        if not demand_verdict:
            if data_sufficiency == "full" and rev_growth_yoy and pat_growth_yoy:
                demand_verdict = (
                    f"Revenue ({rev_growth_yoy}) and PAT growth ({pat_growth_yoy}) "
                    f"underpin institutional QIB participation."
                )
            else:
                demand_verdict = "Financial trajectories pending detailed audited prospectus filing disclosures."

        # Only store financial_metrics if verified financial data exists
        if has_real_rev or has_real_pat or has_real_cfo or rev_growth_yoy or pat_growth_yoy or cfo_to_pat is not None:
            financial_metrics = {
                "data_sufficiency": data_sufficiency,
                "revenue_growth_yoy": rev_growth_yoy,
                "revenue_history": rev_hist,
                "pat_growth_yoy": pat_growth_yoy,
                "pat_history": pat_hist,
                "cfo_history": cfo_hist,
                "cfo_to_pat_ratio": cfo_to_pat,
                "growth_demand_verdict": demand_verdict,
            }
        else:
            financial_metrics = None

        # 2. Gatekeeper Checks (PASS / FAIL / WARN)
        # Kapitl supplies no prospectus data to the model, so none of these can be assessed. Figures the
        # model may return for them (OFS %, P/E, peer P/E, litigation) are never trusted.
        ofs_pct = None
        pe_ratio = None
        peer_pe = None

        is_sme = (ipo.get("type") == "SME") or ("SME" in (ipo.get("name") or ""))
        pending = (
            "Prospectus is on file but Kapitl does not parse it"
            if has_drhp
            else "DRHP not yet filed with SEBI"
        )
        gatekeepers = [
            {
                "key": "ofs_split",
                "name": "OFS vs. Fresh Issue Split",
                "details": f"Not assessed: {pending}.",
                "status": "WARN",
                "threshold": "OFS <= 40% (Fresh >= 60%)",
                "impact": "Cannot tell whether promoters or early investors are offloading equity.",
            },
            {
                "key": "anchor_quality",
                "name": "Anchor Book Quality",
                "details": (
                    "Exempt for SME platform issues (SEBI ICDR regulations)"
                    if is_sme
                    else "Not assessed: no verified anchor allocation data is supplied."
                ),
                "status": "WARN",
                "threshold": "N/A (SME platform)" if is_sme else "Domestic MFs > 30%",
                "impact": (
                    "Anchor investor reservation is optional for SME issues under BSE SME / NSE Emerge norms."
                    if is_sme
                    else "Institutional price floor cannot be evaluated from the supplied data."
                ),
            },
            {
                "key": "cfo_conversion",
                "name": "Cash Flow vs. PAT Conversion",
                "details": f"Not assessed: {pending}; no financial statements supplied.",
                "status": "WARN",
                "threshold": "CFO / PAT Ratio >= 0.70x",
                "impact": "Cannot assess cash collection quality without auditor-certified financials.",
            },
            {
                "key": "valuation_cushion",
                "name": "Valuation Room vs. Listed Peers",
                "details": "Not assessed: no earnings or peer multiples are supplied.",
                "status": "WARN",
                "threshold": ">= 15% discount to peers",
                "impact": "Valuation versus peers cannot be determined from the supplied data.",
            },
            {
                "key": "litigation_exposure",
                "name": "Litigation Liability Ratio",
                "details": f"Not assessed: {pending}; litigation annexures are not read.",
                "status": "WARN",
                "threshold": "Claims < 5% of Issue Size",
                "impact": "Regulatory and litigation risks are not assessed.",
            },
        ]

        # Persist report to database
        stmt = select(AiReport).where(AiReport.ipo_id == ipo["id"])
        res = await db.execute(stmt)
        report_row = res.scalar_one_or_none()

        if report_row:
            report_row.overall_score = overall_score if overall_score is not None else 0  # placeholder when unscored
            report_row.recommendation = recommendation
            report_row.executive_summary = summary_narrative
            report_row.summary_source = summary_source
            report_row.score_financial_quality = fin
            report_row.score_industry_tailwinds = ind
            report_row.score_subscription_momentum = sub_m
            report_row.score_valuation_safety = val
            report_row.score_gmp_strength = gmp_s
            report_row.score_promoter_integrity = gov
            report_row.strengths = strengths
            report_row.risks = risks
            report_row.red_flags = all_red_flags
            report_row.gmp_percent = gmp_pct
            report_row.estimated_listing_price = est_listing_price
            report_row.pe_ratio = pe_ratio
            report_row.peer_avg_pe = peer_pe
            report_row.ofs_percentage = ofs_pct
            report_row.financial_metrics = financial_metrics
            report_row.gatekeepers = gatekeepers
            report_row.is_audited = has_model_scores
            report_row.scored_at = scored_at
        else:
            report_row = AiReport(
                id=f"rep-{str(uuid.uuid4())[:8]}",
                ipo_id=ipo["id"],
                overall_score=overall_score if overall_score is not None else 0,  # placeholder when unscored
                recommendation=recommendation,
                executive_summary=summary_narrative,
                summary_source=summary_source,
                score_financial_quality=fin,
                score_industry_tailwinds=ind,
                score_subscription_momentum=sub_m,
                score_valuation_safety=val,
                score_gmp_strength=gmp_s,
                score_promoter_integrity=gov,
                strengths=strengths,
                risks=risks,
                red_flags=all_red_flags,
                gmp_percent=gmp_pct,
                estimated_listing_price=est_listing_price,
                pe_ratio=pe_ratio,
                peer_avg_pe=peer_pe,
                ofs_percentage=ofs_pct,
                financial_metrics=financial_metrics,
                gatekeepers=gatekeepers,
                is_audited=has_model_scores,
                scored_at=scored_at,
            )
            db.add(report_row)

        # Synchronize score back to Ipo table
        stmt_ipo = select(Ipo).where(Ipo.id == ipo["id"])
        res_ipo = await db.execute(stmt_ipo)
        db_ipo = res_ipo.scalar_one_or_none()
        if db_ipo:
            db_ipo.scored_at = scored_at
            await db.flush()
            from app.services.ipo_service import refresh_stored_score
            await refresh_stored_score(db, db_ipo)
            overall_score = db_ipo.score  # one score everywhere: the stored engine score, not the report's own weighting

        await db.commit()
        await db.refresh(report_row)

        from app.schemas.report import FinancialMetricsSchema, GatekeeperCheckSchema

        return AiReportResponse(
            id=report_row.id,
            ipo_id=report_row.ipo_id,
            ipo_name=ipo.get("name"),
            ipo_symbol=ipo.get("symbol"),
            overall_score=overall_score,
            is_audited=has_model_scores,
            audit_state="AI_COMPLETE" if has_model_scores else "PRELIMINARY",
            audit_note=(
                None if has_model_scores
                else "The AI returned no scores for the assessable areas, so only the preliminary market-signal view is shown."
            ),
            data_sufficiency=data_sufficiency,
            drhp_status=drhp_status,
            drhp_disclaimer=drhp_disclaimer,
            missing_fields=missing_fields,
            recommendation=report_row.recommendation,
            executive_summary=report_row.executive_summary,
            summary_source=report_row.summary_source,
            score_breakdown=ScoreBreakdownSchema(
                financial_quality=report_row.score_financial_quality,
                industry_tailwinds=report_row.score_industry_tailwinds,
                subscription_momentum=report_row.score_subscription_momentum,
                valuation_safety=report_row.score_valuation_safety,
                gmp_strength=report_row.score_gmp_strength,
                promoter_integrity=report_row.score_promoter_integrity,
            ),
            strengths=report_row.strengths or [],
            risks=report_row.risks or [],
            red_flags=[RedFlagSchema(**rf) if isinstance(rf, dict) else rf for rf in (report_row.red_flags or [])],
            financial_metrics=FinancialMetricsSchema(**report_row.financial_metrics) if report_row.financial_metrics else None,
            gatekeepers=[GatekeeperCheckSchema(**gk) for gk in (report_row.gatekeepers or [])],
            pe_ratio=report_row.pe_ratio,
            peer_avg_pe=report_row.peer_avg_pe,
            ofs_percentage=report_row.ofs_percentage,
            gmp_percent=report_row.gmp_percent,
            estimated_listing_price=report_row.estimated_listing_price,
            scored_at=report_row.scored_at,
        )


orchestrator = IpoDueDiligenceOrchestrator()
