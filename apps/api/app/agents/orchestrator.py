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

        # Concurrently execute Analysis and News agents
        analysis_task = analysis_agent.analyze(db, ipo_id)
        news_task = news_agent.analyze(db, ipo_id)
        analysis_res, news_res = await asyncio.gather(analysis_task, news_task)

        # Execute Allocation strategist with synthesized inputs
        allocation_res = await allocation_agent.strategize(db, ipo_id)

        # Extract dimension scores
        fin = int(analysis_res.get("financial_quality_score", 70))
        val = int(analysis_res.get("valuation_safety_score", 65))
        gov = int(news_res.get("promoter_integrity_score", 75))
        ind = int(news_res.get("industry_tailwinds_score", 75))

        gmp_pct = float(ipo.get("gmp_percent") or 0.0)
        gmp_s = min(100, max(0, int(gmp_pct * 2.0)))

        qib_sub = float(ipo.get("subscription_qib") or 0.0)
        sub_m = min(100, max(20, int(qib_sub * 8.0) if qib_sub > 0 else 50))

        # Collect red flags
        all_red_flags = []
        for rf in analysis_res.get("accounting_red_flags", []):
            if isinstance(rf, dict):
                item = dict(rf)
                item["title"] = item.get("title") or item.get("type") or "Accounting Risk"
                all_red_flags.append(item)
            else:
                all_red_flags.append({"title": str(rf), "severity": "MEDIUM", "description": str(rf), "penalty_points": 0})
        for gf in news_res.get("governance_flags", []):
            if isinstance(gf, dict):
                item = dict(gf)
                item["title"] = item.get("title") or item.get("type") or "Governance Flag"
                all_red_flags.append(item)
            else:
                all_red_flags.append({"title": str(gf), "severity": "MEDIUM", "description": str(gf), "penalty_points": 0})

        penalties = sum(rf.get("penalty_points", 0) for rf in all_red_flags)
        overall_score = self.compute_weighted_score(fin, ind, sub_m, val, gmp_s, gov, penalties)
        recommendation = self.get_recommendation(overall_score)

        price_max = float(ipo.get("price_band_max") or 100.0)
        est_listing_price = round(price_max * (1 + (gmp_pct / 100.0)), 2)
        scored_at = datetime.now(timezone.utc).strftime("%d %b %Y")

        summary_narrative = (
            f"{ipo['name']} exhibits a fundamental score of {overall_score}/100 with a '{recommendation}' recommendation. "
            f"Financial quality scored {fin}/100 and valuation safety scored {val}/100. "
            f"Market sentiment is {news_res.get('market_buzz_rating', 'MODERATE')} with current GMP at {gmp_pct}%. "
            f"Optimal allocation strategy: {allocation_res.get('recommended_primary_category', 'RETAIL')} bidding."
        )

        strengths = analysis_res.get("strengths_summary", ipo.get("strengths", []))
        risks = analysis_res.get("concerns_summary", ipo.get("risks", []))

        # Persist report to database
        stmt = select(AiReport).where(AiReport.ipo_id == ipo["id"])
        res = await db.execute(stmt)
        report_row = res.scalar_one_or_none()

        if report_row:
            report_row.overall_score = overall_score
            report_row.recommendation = recommendation
            report_row.executive_summary = summary_narrative
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
            report_row.scored_at = scored_at
        else:
            report_row = AiReport(
                id=f"rep-{str(uuid.uuid4())[:8]}",
                ipo_id=ipo["id"],
                overall_score=overall_score,
                recommendation=recommendation,
                executive_summary=summary_narrative,
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
                scored_at=scored_at,
            )
            db.add(report_row)

        # Synchronize score back to Ipo table
        stmt_ipo = select(Ipo).where(Ipo.id == ipo["id"])
        res_ipo = await db.execute(stmt_ipo)
        db_ipo = res_ipo.scalar_one_or_none()
        if db_ipo:
            db_ipo.score = overall_score
            db_ipo.recommendation = recommendation
            db_ipo.scored_at = scored_at

        await db.commit()
        await db.refresh(report_row)

        return AiReportResponse(
            id=report_row.id,
            ipo_id=report_row.ipo_id,
            ipo_name=ipo.get("name"),
            ipo_symbol=ipo.get("symbol"),
            overall_score=report_row.overall_score,
            recommendation=report_row.recommendation,
            executive_summary=report_row.executive_summary,
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
            gmp_percent=report_row.gmp_percent,
            estimated_listing_price=report_row.estimated_listing_price,
            scored_at=report_row.scored_at,
        )


orchestrator = IpoDueDiligenceOrchestrator()
