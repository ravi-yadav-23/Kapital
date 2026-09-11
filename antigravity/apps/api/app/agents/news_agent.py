import json
import logging
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import BaseAgent
from app.agents.prompts import NEWS_AGENT_SYSTEM
from app.agents.tools import get_ipo_full_profile

logger = logging.getLogger("agent.news")


class NewsAgent(BaseAgent):
    """
    Market Sentiment, Litigation & Management Credibility Agent.
    Evaluates promoter integrity, anchor investor commitment, and public market appetite.
    """

    def __init__(self):
        super().__init__(
            name="NewsAgent",
            role="Chief Market Sentiment & Investigative Analyst",
            goal="Identify promoter track record, regulatory friction, and retail demand momentum.",
            backstory="Veteran financial investigative journalist with deep sources across Dalal Street, merchant bankers, and grey market operators.",
        )

    async def analyze(self, db: AsyncSession, ipo_id_or_symbol: str) -> Dict[str, Any]:
        """Executes market sentiment and governance evaluation on target IPO."""
        ipo = await get_ipo_full_profile(db, ipo_id_or_symbol)
        if not ipo:
            raise ValueError(f"IPO '{ipo_id_or_symbol}' not found.")

        ai_cfg = await self.get_ai_config(db)

        user_prompt = f"""
COMPANY: {ipo.get('name')} ({ipo.get('symbol')})
GREY MARKET PREMIUM (GMP): {ipo.get('gmp_percent')}%
SUBSCRIPTION MOMENTUM:
- Retail: {ipo.get('subscription_retail')}x
- sHNI: {ipo.get('subscription_shni')}x
- bHNI: {ipo.get('subscription_bhni')}x
- QIB: {ipo.get('subscription_qib')}x
- Total: {ipo.get('subscription_total')}x
ISSUE PROFILE:
- Type: {ipo.get('type')}
- Issue Size: {ipo.get('issue_size')}
- Stated Risks: {json.dumps(ipo.get('risks', []))}
"""

        res = await self.call_llm(NEWS_AGENT_SYSTEM, user_prompt, ai_cfg)
        if res:
            return res

        # Fallback based on GMP and subscription
        gmp = ipo.get("gmp_percent", 0.0)
        qib = ipo.get("subscription_qib", 0.0)

        promoter_score = 75 if gmp >= 10 else 60
        tailwinds_score = 80 if qib >= 2.0 or gmp >= 25 else 65

        buzz = "VERY_HIGH" if gmp >= 40 else "HIGH" if gmp >= 20 else "MODERATE" if gmp >= 5 else "SUBDUED"

        return {
            "promoter_integrity_score": promoter_score,
            "industry_tailwinds_score": tailwinds_score,
            "market_buzz_rating": buzz,
            "governance_flags": [],
            "anchor_quality_verdict": "Standard institutional participation expected.",
            "sentiment_summary": f"Market appetite is {buzz.lower().replace('_', ' ')} with current GMP around {gmp}%.",
        }


news_agent = NewsAgent()
