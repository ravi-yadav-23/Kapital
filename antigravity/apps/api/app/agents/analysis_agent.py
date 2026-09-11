import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import BaseAgent
from app.agents.prompts import ANALYSIS_AGENT_SYSTEM
from app.agents.tools import get_ipo_full_profile, get_sector_benchmarks

logger = logging.getLogger("agent.analysis")


class AnalysisAgent(BaseAgent):
    """
    Forensic Financial & Valuation Agent.
    Analyzes fundamentals, debt-to-equity, issue size structure, and peer multiples.
    """

    def __init__(self):
        super().__init__(
            name="AnalysisAgent",
            role="Lead Equity Research & Valuation Analyst",
            goal="Identify genuine fundamental strength, pricing anomalies, and balance sheet red flags.",
            backstory="Former institutional equity analyst at a tier-1 Indian mutual fund, specializing in IPO DRHP forensic due diligence.",
        )

    async def analyze(self, db: AsyncSession, ipo_id_or_symbol: str) -> Dict[str, Any]:
        """Executes full forensic financial analysis on target IPO."""
        ipo = await get_ipo_full_profile(db, ipo_id_or_symbol)
        if not ipo:
            raise ValueError(f"IPO '{ipo_id_or_symbol}' not found.")

        ai_cfg = await self.get_ai_config(db)
        benchmarks = get_sector_benchmarks(ipo.get("type"))

        user_prompt = f"""
COMPANY: {ipo.get('name')} ({ipo.get('symbol')})
TYPE: {ipo.get('type')} | STATUS: {ipo.get('status')}
PRICE BAND: ₹{ipo.get('price_band_min')} - ₹{ipo.get('price_band_max')}
LOT SIZE: {ipo.get('lot_size')} shares | MIN INVESTMENT: ₹{ipo.get('min_investment')}
ISSUE SIZE: {ipo.get('issue_size')} (Approx ₹{ipo.get('issue_size_cr')} Cr)
ABOUT: {ipo.get('about')}
STATED STRENGTHS: {json.dumps(ipo.get('strengths', []))}
STATED RISKS: {json.dumps(ipo.get('risks', []))}
SECTOR BENCHMARKS: {json.dumps(benchmarks)}
"""

        res = await self.call_llm(ANALYSIS_AGENT_SYSTEM, user_prompt, ai_cfg)
        if res:
            return res

        # Algorithmic fallback when no LLM API key is present
        gmp = ipo.get("gmp_percent", 0.0)
        fin_score = 70 + min(15, len(ipo.get("strengths", [])) * 3) - min(20, len(ipo.get("risks", [])) * 4)
        val_score = 65 + (5 if gmp > 20 else -5)

        return {
            "financial_quality_score": max(30, min(95, fin_score)),
            "valuation_safety_score": max(30, min(95, val_score)),
            "strengths_summary": ipo.get("strengths", ["Solid industry presence"]),
            "concerns_summary": ipo.get("risks", ["General market risks"]),
            "accounting_red_flags": [],
            "fair_value_estimate_inr": (ipo.get("price_band_max") or 100.0) * 1.15,
            "analyst_verdict": "Moderate fundamental profile. Monitor subscription before applying.",
        }


analysis_agent = AnalysisAgent()
