from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ipo import Ipo
from app.models.account import FamilyAccount


async def get_ipo_full_profile(db: AsyncSession, ipo_id_or_symbol: str) -> Optional[Dict[str, Any]]:
    """Fetches complete structural, financial, and descriptive profile of an IPO issue."""
    stmt = select(Ipo).where(
        (Ipo.id == ipo_id_or_symbol) | (Ipo.symbol == ipo_id_or_symbol) | (Ipo.slug == ipo_id_or_symbol.lower())
    )
    res = await db.execute(stmt)
    ipo = res.scalar_one_or_none()
    if not ipo:
        return None

    return {
        "id": ipo.id,
        "name": ipo.name,
        "symbol": ipo.symbol,
        "type": ipo.type or "EQ",
        "status": ipo.status,
        "price_band_min": ipo.price_band_min,
        "price_band_max": ipo.price_band_max,
        "lot_size": ipo.lot_size,
        "min_investment": ipo.min_investment,
        "issue_size": ipo.issue_size,
        "issue_size_cr": ipo.issue_size_cr,
        "issue_open_date": ipo.issue_open_date,
        "issue_close_date": ipo.issue_close_date,
        "listing_date": ipo.listing_date,
        "about": ipo.about,
        "strengths": ipo.strengths or [],
        "risks": ipo.risks or [],
        "gmp_percent": ipo.gmp_percent or 0.0,
        "subscription_retail": ipo.subscription_retail or 0.0,
        "subscription_shni": ipo.subscription_shni or 0.0,
        "subscription_bhni": ipo.subscription_bhni or 0.0,
        "subscription_qib": ipo.subscription_qib or 0.0,
        "subscription_total": ipo.subscription_total or 0.0,
    }


async def get_family_corpus_profile(db: AsyncSession, min_retail_ticket: float = 15000.0) -> Dict[str, Any]:
    """Retrieves family demat accounts, total available liquidity, and category readiness."""
    stmt = select(FamilyAccount).where(FamilyAccount.is_active == True)
    res = await db.execute(stmt)
    accounts = res.scalars().all()

    total_liquid = sum(a.available_liquid_balance or 0.0 for a in accounts)
    total_locked = sum(a.locked_asba_balance or 0.0 for a in accounts)
    total_demat = sum(a.total_demat_balance or 0.0 for a in accounts)

    retail_capable = [a for a in accounts if (a.available_liquid_balance or 0.0) >= min_retail_ticket]
    shni_capable = [a for a in accounts if (a.available_liquid_balance or 0.0) >= 200000]
    bhni_capable = [a for a in accounts if (a.available_liquid_balance or 0.0) >= 1000000]

    return {
        "accounts_count": len(accounts),
        "total_liquid": total_liquid,
        "total_locked": total_locked,
        "total_demat": total_demat,
        "retail_capable_accounts": len(retail_capable),
        "shni_capable_accounts": len(shni_capable),
        "bhni_capable_accounts": len(bhni_capable),
        "accounts_summary": [
            {
                "id": a.id,
                "name": a.name,
                "relation": a.relation,
                "available": a.available_liquid_balance or 0.0,
                "preferred_category": a.default_category_preference or "RETAIL",
            }
            for a in accounts
        ],
    }


def get_sector_benchmarks(sector_name: Optional[str] = None) -> Dict[str, Any]:
    """Provides valuation benchmarks for major Indian equity sectors."""
    benchmarks = {
        "IT": {"pe_median": 28.0, "roce_median": 22.0, "pat_margin": 16.0},
        "PHARMA": {"pe_median": 32.0, "roce_median": 18.0, "pat_margin": 14.0},
        "AUTO": {"pe_median": 24.0, "roce_median": 15.0, "pat_margin": 8.0},
        "BANKING": {"pe_median": 16.0, "roce_median": 14.0, "pat_margin": 20.0},
        "INFRA": {"pe_median": 20.0, "roce_median": 13.0, "pat_margin": 7.0},
        "DEFAULT": {"pe_median": 25.0, "roce_median": 15.0, "pat_margin": 10.0},
    }
    sec_key = (sector_name or "").upper().strip()
    return benchmarks.get(sec_key, benchmarks["DEFAULT"])
