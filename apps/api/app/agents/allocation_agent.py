import json
import logging
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import BaseAgent
from app.agents.prompts import ALLOCATION_AGENT_SYSTEM
from app.agents.tools import get_ipo_full_profile, get_family_corpus_profile

logger = logging.getLogger("agent.allocation")


class AllocationAgent(BaseAgent):
    """
    Strategic Capital Allocation & Bidding Category Optimization Agent.
    Evaluates probability of allotment in Retail vs sHNI vs bHNI and recommends fund routing.
    """

    def __init__(self):
        super().__init__(
            name="AllocationAgent",
            role="Senior Portfolio & Capital Allocation Strategist",
            goal="Maximize expected listing gains across family demat accounts under SEBI allotment constraints.",
            backstory="Quantitative portfolio manager specializing in multi-account retail syndication and high-net-worth IPO bidding strategies.",
        )

    async def strategize(self, db: AsyncSession, ipo_id_or_symbol: str) -> Dict[str, Any]:
        """Formulates actionable multi-account bidding strategy for target IPO."""
        ipo = await get_ipo_full_profile(db, ipo_id_or_symbol)
        if not ipo:
            raise ValueError(f"IPO '{ipo_id_or_symbol}' not found.")

        family = await get_family_corpus_profile(db)
        ai_cfg = await self.get_ai_config(db)

        user_prompt = f"""
TARGET IPO: {ipo.get('name')} ({ipo.get('symbol')})
GMP: {ipo.get('gmp_percent')}% | MIN INVESTMENT: ₹{ipo.get('min_investment')} | LOT SIZE: {ipo.get('lot_size')}
SUBSCRIPTION:
- Retail: {ipo.get('subscription_retail')}x
- sHNI: {ipo.get('subscription_shni')}x
- bHNI: {ipo.get('subscription_bhni')}x
- QIB: {ipo.get('subscription_qib')}x

FAMILY PORTFOLIO CAPACITY:
- Total Liquid Funds: ₹{family.get('total_liquid')}
- Registered Accounts: {family.get('accounts_count')}
- Retail-capable Accounts (>= ₹15k): {family.get('retail_capable_accounts')}
- sHNI-capable Accounts (>= ₹2L): {family.get('shni_capable_accounts')}
- bHNI-capable Accounts (>= ₹10L): {family.get('bhni_capable_accounts')}
- Accounts Detail: {json.dumps(family.get('accounts_summary', []))}
"""

        res = await self.call_llm(ALLOCATION_AGENT_SYSTEM, user_prompt, ai_cfg)
        if res and not res.get("analysis_failed"):
            return res

        # Algorithmic fallback
        gmp = ipo.get("gmp_percent", 0.0)
        rec_cat = "RETAIL"
        if family.get("bhni_capable_accounts", 0) > 0 and gmp >= 35.0:
            rec_cat = "bHNI"
        elif family.get("shni_capable_accounts", 0) > 0 and gmp >= 20.0:
            rec_cat = "sHNI"

        actions = []
        for acc in family.get("accounts_summary", []):
            actions.append({
                "account_name": acc.get("name"),
                "category": acc.get("preferred_category", "RETAIL"),
                "lots": 1,
                "approx_capital": ipo.get("min_investment", 15000),
            })

        return {
            "recommended_primary_category": rec_cat,
            "capital_efficiency_score": 85,
            "rationale": f"With {gmp}% GMP, deploying {rec_cat} maximizes risk-adjusted listing day upside across connected demats.",
            "lottery_probability_assessment": "Standard lottery odds for retail. High probability of allotment in sHNI/bHNI if applied early.",
            "suggested_actions_per_account": actions,
            "asba_liquidity_caution": "ASBA lock will remain active until allotment finalization (~3-4 business days).",
        }


allocation_agent = AllocationAgent()
