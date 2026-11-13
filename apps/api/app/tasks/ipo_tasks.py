import httpx
import logging
import json
import re
import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ipo_service import ipo_service
from app.utils.text_utils import clean_text, clean_text_list
from app.utils.date_utils import compute_ipo_status, calculate_listing_date

logger = logging.getLogger("ipo_tasks")

BASE_IPOALERTS_URL = "https://api.ipoalerts.in/ipos"


def _parse_price_range(price_range_str: str) -> tuple[float, float]:
    """Parse '118-124' or '120' into (min_price, max_price)."""
    try:
        if "-" in price_range_str:
            parts = price_range_str.split("-")
            return float(parts[0].strip()), float(parts[1].strip())
        val = float(price_range_str.strip())
        return val, val
    except Exception:
        return 100.0, 100.0


def _parse_issue_size_cr(issue_size_str: str) -> float:
    """Parse '351cr' or '45 Cr' into 351.0."""
    try:
        clean = issue_size_str.lower().replace("cr", "").replace(",", "").strip()
        return float(clean)
    except Exception:
        return 0.0


from app.config import settings
from app.utils.score_engine import IpoScoreEngine

import asyncio

def _parse_ipowatch_dates(d_str: str, year: Optional[int] = None) -> tuple[Optional[str], Optional[str]]:
    if not d_str or not isinstance(d_str, str):
        return None, None
    if year is None:
        year = datetime.date.today().year
    months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    m_clean = d_str.strip().lower()
    # Normalize unicode dashes (en-dash, em-dash, minus) to regular hyphen
    m_clean = re.sub(r'[\u2010-\u2015\u2212]', '-', m_clean)

    # Check if an explicit 4-digit year is present
    year_match = re.search(r'\b(20\d{2})\b', m_clean)
    if year_match:
        year = int(year_match.group(1))

    # Match cross-month pattern like "30 Oct - 3 Nov" or "30 Oct to 3 Nov"
    two_month_match = re.search(r'(\d{1,2})\s*([a-z]{3,4})\s*(?:-|to|\s)\s*(\d{1,2})\s*([a-z]{3,4})', m_clean)
    if two_month_match:
        d1, m1_str, d2, m2_str = two_month_match.groups()
        m1 = months.get(m1_str[:3])
        m2 = months.get(m2_str[:3])
        if m1 and m2:
            y_open = year
            y_close = year
            if m1 == 12 and m2 == 1:
                y_close = year + 1
            try:
                d_open = datetime.date(y_open, m1, int(d1))
                d_close = datetime.date(y_close, m2, int(d2))
                return d_open.isoformat(), d_close.isoformat()
            except ValueError:
                pass

    # Match pattern like "Oct 30 - Nov 3"
    two_month_match2 = re.search(r'([a-z]{3,4})\s*(\d{1,2})\s*(?:-|to|\s)\s*([a-z]{3,4})\s*(\d{1,2})', m_clean)
    if two_month_match2:
        m1_str, d1, m2_str, d2 = two_month_match2.groups()
        m1 = months.get(m1_str[:3])
        m2 = months.get(m2_str[:3])
        if m1 and m2:
            y_open = year
            y_close = year
            if m1 == 12 and m2 == 1:
                y_close = year + 1
            try:
                d_open = datetime.date(y_open, m1, int(d1))
                d_close = datetime.date(y_close, m2, int(d2))
                return d_open.isoformat(), d_close.isoformat()
            except ValueError:
                pass

    for m_name, m_num in months.items():
        if m_name in m_clean:
            raw_nums = [int(n) for n in re.findall(r'\b\d+\b', m_clean)]
            nums = [n for n in raw_nums if 1 <= n <= 31 and n != year]
            try:
                if len(nums) >= 2:
                    day1, day2 = nums[0], nums[1]
                    if day1 > day2:
                        # Cross-month rollover (e.g. "30-3 Nov" opens Oct 30 and closes Nov 3)
                        m_open = m_num - 1 if m_num > 1 else 12
                        y_open = year if m_num > 1 else year - 1
                        m_close = m_num
                        y_close = year
                    else:
                        m_open = m_num
                        y_open = year
                        m_close = m_num
                        y_close = year

                    d_open = datetime.date(y_open, m_open, day1)
                    d_close = datetime.date(y_close, m_close, day2)
                    return d_open.isoformat(), d_close.isoformat()
                elif len(nums) == 1:
                    d_open = datetime.date(year, m_num, nums[0])
                    return d_open.isoformat(), d_open.isoformat()
            except ValueError:
                pass
    return None, None


async def sync_ipos_pipeline(db: AsyncSession, sources=None) -> int:
    """
    Multi-source IPO ingestion: every enabled source plug-in (Groww, ipoalerts, IPO Watch ...) is run
    by the source runner, which isolates failures, records health and enforces request budgets.
    Records are merged by multi-tier entity resolution; closed IPOs are preserved and never deleted.

    This no longer generates AI reports: LLM work is budgeted and done by the nightly analysis job.
    """
    from app.sources.runner import run_sources

    reports = await run_sources(db, sources)
    synced_count = sum(r.upserted for r in reports)
    logger.info(
        "IPO sync complete: " + ", ".join(f"{r.name}={r.status}({r.upserted})" for r in reports)
        + f". Total {synced_count} IPO records upserted."
    )

    try:
        from app.routers.websocket import broadcast_event
        await broadcast_event("IPOS_SYNCED", {"count": synced_count})
    except Exception:
        pass

    return synced_count


async def sync_ipos_task() -> int:
    """Wrapper to run sync_ipos_pipeline in a self-managed DB session."""
    from app.db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await sync_ipos_pipeline(db)


async def sync_open_ipo_subscriptions(db: AsyncSession, source=None) -> int:
    """
    Refresh the live subscription multiple for currently OPEN IPOs from ipoalerts (official NSE figure).

    Fixed: the old query used columns that do not exist (Ipo.open_date / Ipo.close_date), so this job
    crashed every time; it also overwrote known category values with zeros. Now it only updates the
    fields the source actually reports, respects the daily request budget, and refreshes the stored
    score (with a history row) when a value changes.
    Returns the number of IPOs updated.
    """
    from datetime import date
    from sqlalchemy import select
    from app.models.ipo import Ipo
    from app.services.ipo_service import refresh_stored_score
    from app.sources.ipoalerts import IpoAlertsSource
    from app.sources.runner import add_usage, remaining_budget

    today = date.today()
    open_ipos = (await db.execute(
        select(Ipo).where(Ipo.issue_open_date <= today, Ipo.issue_close_date >= today)
    )).scalars().all()
    if not open_ipos:
        logger.info("[Sub-Sync] No open IPOs today - skipping subscription refresh.")
        return 0

    source = source or IpoAlertsSource()
    allowed = await remaining_budget(db, source)
    if allowed is not None and allowed <= 0:
        logger.info("[Sub-Sync] Daily request budget used up - skipping.")
        return 0

    result = await source.fetch(requests_allowed=allowed)
    await add_usage(db, source, result.requests_used)
    if result.error:
        logger.warning(f"[Sub-Sync] {source.name} failed: {result.error}")
        await db.commit()
        return 0

    live = {}
    for rec in result.records:
        sym = (rec.get("symbol") or "").upper().replace("-EQ", "").strip()
        if sym:
            live[sym] = rec

    fields = ["subscription_retail", "subscription_shni", "subscription_bhni", "subscription_qib", "subscription_total"]
    updated = 0
    for ipo in open_ipos:
        rec = live.get((ipo.symbol or "").upper().replace("-EQ", "").strip())
        if not rec:
            continue
        changed = False
        for f in fields:
            val = rec.get(f)
            if val is not None and float(val) > 0 and float(val) != float(getattr(ipo, f) or 0.0):
                setattr(ipo, f, float(val))
                changed = True
        if changed:
            await refresh_stored_score(db, ipo)
            updated += 1
            logger.info(f"[Sub-Sync] {ipo.symbol}: total={ipo.subscription_total}x qib={ipo.subscription_qib}x")

    await db.commit()
    logger.info(f"[Sub-Sync] Updated {updated}/{len(open_ipos)} open IPOs.")
    return updated
