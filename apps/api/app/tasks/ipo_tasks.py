import httpx
import logging
from typing import Dict, Any, List, Optional
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

async def fetch_ipos_from_ipoalerts(status: str) -> List[Dict[str, Any]]:
    """Fetch raw IPOs for a given status from ipoalerts.in API with standard browser headers and API key if available."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://ipoalerts.in/",
        "Accept": "application/json, text/plain, */*",
    }
    if settings.ipoalerts_api_key:
        headers["Authorization"] = f"Bearer {settings.ipoalerts_api_key}"
        headers["X-API-KEY"] = settings.ipoalerts_api_key
    try:
        async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
            res = await client.get(f"{BASE_IPOALERTS_URL}?status={status}")
            if res.status_code == 200:
                data = res.json()
                return data.get("ipos", [])
            elif res.status_code == 429:
                logger.warning(f"ipoalerts.in rate limit reached (status={status}). Using cached/existing records.")
            else:
                logger.warning(f"ipoalerts.in returned HTTP {res.status_code} for status={status}")
    except Exception as e:
        logger.error(f"Error fetching {status} IPOs from ipoalerts.in: {e}")
    return []


import re
import datetime
from bs4 import BeautifulSoup


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


async def fetch_ipos_from_ipowatch() -> List[Dict[str, Any]]:
    """Fetch live Mainboard and SME IPO listings with real-time GMP from ipowatch.in."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    ipos = []
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
            res = await client.get('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/')
            if res.status_code != 200:
                logger.warning(f"ipowatch.in returned HTTP {res.status_code}")
                return []
            
            soup = BeautifulSoup(res.text, 'html.parser')
            tables = soup.find_all('table')
            today = datetime.date.today()
            
            for t_idx, table in enumerate(tables):
                rows = table.find_all('tr')
                if not rows:
                    continue

                # Dynamically locate columns from table header
                header_row = rows[0]
                header_cols = [th.get_text(strip=True).lower() for th in header_row.find_all(['td', 'th'])]
                if not header_cols:
                    continue

                name_idx = next((i for i, h in enumerate(header_cols) if any(k in h for k in ['ipo', 'company', 'name'])), 0)
                gmp_idx = next((i for i, h in enumerate(header_cols) if 'gmp' in h or 'premium' in h), 1)
                price_idx = next((i for i, h in enumerate(header_cols) if 'price' in h), 3)
                date_idx = next((i for i, h in enumerate(header_cols) if any(k in h for k in ['date', 'open', 'close'])), 5)

                table_parent_text = str(table.parent).lower() if table.parent else ""
                is_sme_table = "sme" in table_parent_text or t_idx == 1

                for row in rows[1:]:
                    cols = [td.get_text(strip=True).replace('\u20b9', '').replace(',', '').strip() for td in row.find_all(['td', 'th'])]
                    if len(cols) > max(name_idx, gmp_idx):
                        name = cols[name_idx]
                        if not name or len(name) < 2 or "ipo name" in name.lower():
                            continue

                        # Clean out table tag artifacts like "Open", "Upcoming", "Closed" joined without spaces
                        status_match = re.search(r'(Open|Upcoming|Closed|Allotted|Listed)$', name, flags=re.IGNORECASE)
                        feed_status_hint = status_match.group(1).lower() if status_match else None
                        name = re.sub(r'(Open|Upcoming|Closed|Allotted|Listed)$', '', name, flags=re.IGNORECASE).strip()

                        gmp_str = cols[gmp_idx] if gmp_idx < len(cols) else "0"
                        price_str = cols[price_idx] if price_idx < len(cols) else "100"
                        dates = cols[date_idx] if date_idx < len(cols) else ""
                        ipo_type = 'SME' if is_sme_table or 'sme' in name.lower() else 'EQ'
                        
                        try:
                            gmp_val = float(re.findall(r'[-+]?\d*\.\d+|\d+', gmp_str)[0]) if re.findall(r'[-+]?\d*\.\d+|\d+', gmp_str) else 0.0
                        except Exception:
                            gmp_val = 0.0
                        
                        try:
                            price_nums = [float(x) for x in re.findall(r'\d+', price_str)]
                            if len(price_nums) >= 2:
                                min_p, max_p = price_nums[0], price_nums[1]
                            elif len(price_nums) == 1:
                                min_p = max_p = price_nums[0]
                            else:
                                min_p = max_p = 100.0
                        except Exception:
                            min_p = max_p = 100.0
                        
                        gmp_pct = round((gmp_val / max_p) * 100, 2) if max_p > 0 else 0.0
                        open_d_str, close_d_str = _parse_ipowatch_dates(dates)
                        status = compute_ipo_status(open_d_str, close_d_str)
                        if feed_status_hint == "open" and status != "closed":
                            status = "open"
                        
                        clean_sym = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:10]
                        slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
                        lot_size = max(1, int(15000 / max_p)) if ipo_type == 'EQ' else max(100, int(120000 / max_p))
                        min_inv = round(lot_size * max_p, 2)
                        
                        score, rec, _ = IpoScoreEngine.compute_score({
                            'gmp_percent': gmp_pct,
                            'subscription_qib': 0.0,
                            'subscription_total': 0.0,
                            'issue_size_cr': 0.0,
                        })
                        
                        ipos.append({
                            'symbol': clean_sym,
                            'name': clean_text(name),
                            'slug': slug,
                            'type': ipo_type,
                            'status': status,
                            'price_band_min': min_p,
                            'price_band_max': max_p,
                            'lot_size': lot_size,
                            'min_investment': min_inv,
                            'issue_size_cr': 0.0,
                            'issue_open_date': open_d_str,
                            'issue_close_date': close_d_str,
                            'about': clean_text(f"{name} ({ipo_type}) issue on Indian exchanges with price band Rs {min_p}-{max_p} and active GMP of {gmp_pct}%."),
                            'strengths': clean_text_list(['Strong market demand' if gmp_pct > 0 else 'Exchange-tracked IPO', f'Indicative GMP: {gmp_pct}%']),
                            'risks': clean_text_list(['General market risk', 'Working capital requirements']),
                            'score': score,
                            'recommendation': rec,
                            'gmp_percent': gmp_pct,
                            'subscription_retail': 0.0,
                            'subscription_shni': 0.0,
                            'subscription_bhni': 0.0,
                            'subscription_qib': 0.0,
                            'subscription_total': 0.0,
                            'is_secondary_feed': True,
                        })
    except Exception as e:
        logger.error(f"Error scraping live IPOs from ipowatch: {e}")
    return ipos


async def sync_ipos_pipeline(db: AsyncSession) -> int:
    """
    Fetch open and upcoming IPOs from live market feeds (ipoalerts primary, ipowatch secondary) and upsert into PostgreSQL.
    """
    synced_count = 0

    # 1. Primary Feed: ipoalerts.in (Structured API with details, subscription, schedule)
    statuses = ["open", "upcoming", "closed"]
    for status in statuses:
        raw_ipos = await fetch_ipos_from_ipoalerts(status)
        if raw_ipos:
            await asyncio.sleep(0.5)  # Throttle to respect ipoalerts rate limits
        for raw in raw_ipos:
            try:
                min_p, max_p = _parse_price_range(raw.get("priceRange", "100-100"))
                lot_sz = int(raw.get("minQty", 1))
                min_inv = float(raw.get("minAmount") or (max_p * lot_sz))
                issue_cr = _parse_issue_size_cr(raw.get("issueSize", "0"))
                
                sub_dict = raw.get("subscription") or {}
                sub_retail = float(raw.get("subscription_retail") or sub_dict.get("retail") or 0.0)
                sub_shni = float(raw.get("subscription_shni") or sub_dict.get("shni") or sub_dict.get("snii") or 0.0)
                sub_bhni = float(raw.get("subscription_bhni") or sub_dict.get("bhni") or sub_dict.get("bnii") or 0.0)
                sub_qib = float(raw.get("subscription_qib") or sub_dict.get("qib") or 0.0)
                sub_total = float(raw.get("subscription_total") or sub_dict.get("total") or 0.0)

                raw["issue_size_cr"] = issue_cr
                raw["subscription_qib"] = sub_qib
                raw["subscription_total"] = sub_total
                
                score, rec, gmp = IpoScoreEngine.compute_score(raw)

                schedule_list = []
                for s in raw.get("schedule", []):
                    schedule_list.append({
                        "event": s.get("event"),
                        "date": s.get("date"),
                    })

                ipo_dict = {
                    "symbol": clean_text(raw.get("symbol", "IPO")),
                    "name": clean_text(raw.get("name", "IPO Issue")),
                    "slug": raw.get("slug", raw.get("symbol", "").lower()),
                    "type": raw.get("type", "EQ"),
                    "status": compute_ipo_status(raw.get("startDate"), raw.get("endDate")),
                    "logo_url": raw.get("logo"),
                    "price_band_min": min_p,
                    "price_band_max": max_p,
                    "lot_size": lot_sz,
                    "min_investment": min_inv,
                    "issue_size": clean_text(raw.get("issueSize")),
                    "issue_size_cr": issue_cr,
                    "issue_open_date": raw.get("startDate"),
                    "issue_close_date": raw.get("endDate"),
                    "listing_date": raw.get("listingDate"),
                    "about": clean_text(raw.get("about")),
                    "strengths": clean_text_list(raw.get("strengths", [])),
                    "risks": clean_text_list(raw.get("risks", [])),
                    "score": score,
                    "recommendation": rec,
                    "gmp_percent": gmp,
                    "subscription_retail": sub_retail,
                    "subscription_shni": sub_shni,
                    "subscription_bhni": sub_bhni,
                    "subscription_qib": sub_qib,
                    "subscription_total": sub_total,
                    "schedule": schedule_list,
                }

                await ipo_service.upsert_ipo(db, ipo_dict)
                synced_count += 1
            except Exception as ex:
                logger.error(f"Failed to ingest IPO {raw.get('symbol')}: {ex}")

    # 2. Secondary / Live GMP Feed: ipowatch.in (Mainboard & SME with live GMP)
    live_ipos = await fetch_ipos_from_ipowatch()
    for ipo_dict in live_ipos:
        try:
            await ipo_service.upsert_ipo(db, ipo_dict)
            synced_count += 1
        except Exception as ex:
            logger.error(f"Failed to upsert live IPO {ipo_dict.get('symbol')}: {ex}")

    await db.commit()
    logger.info(f"IPO sync complete. Total {synced_count} IPOs upserted into PostgreSQL.")

    # 3. Single-Run AI Reports: Generate AI Due Diligence report once for active IPOs
    try:
        from app.models.ipo import Ipo
        from app.models.report import AiReport
        from app.services.report_service import report_service
        from sqlalchemy import select

        stmt_active = select(Ipo).where(Ipo.status.in_(["open", "closing_today", "upcoming"]))
        res_active = await db.execute(stmt_active)
        active_ipos = res_active.scalars().all()

        for ipo_item in active_ipos:
            stmt_r = select(AiReport).where(AiReport.ipo_id == ipo_item.id)
            res_r = await db.execute(stmt_r)
            if not res_r.scalar_one_or_none():
                logger.info(f"[AI Report] Generating initial one-time report for live IPO {ipo_item.symbol}...")
                await report_service.get_or_generate_report(db, ipo_item, force_refresh=False)
    except Exception as e:
        logger.warning(f"Could not auto-generate one-time AI reports after sync: {e}")

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


async def sync_open_ipo_subscriptions(db: AsyncSession) -> int:
    """
    Intraday job: Refresh subscription metrics ONLY for currently OPEN IPOs.
    Fetches live QIB / sHNI / bHNI / Retail / Total subscription multiples
    from ipoalerts.in and persists to PostgreSQL.
    Returns the number of IPOs whose subscription data was updated.
    """
    from app.models.ipo import Ipo
    from sqlalchemy import select
    from datetime import date

    today = date.today()
    stmt = select(Ipo).where(
        Ipo.open_date <= today,
        Ipo.close_date >= today,
    )
    res = await db.execute(stmt)
    open_ipos: list[Ipo] = res.scalars().all()

    if not open_ipos:
        logger.info("[Sub-Sync] No open IPOs today — skipping intraday subscription refresh.")
        return 0

    logger.info(f"[Sub-Sync] Refreshing subscriptions for {len(open_ipos)} open IPO(s)...")
    updated = 0

    # Fetch live data from the OPEN status endpoint
    live_data = await fetch_ipos_from_ipoalerts("open")
    live_map: Dict[str, Dict[str, Any]] = {}
    for raw in live_data:
        sym = (raw.get("symbol") or raw.get("name") or "").upper().strip()
        if sym:
            live_map[sym] = raw

    for ipo in open_ipos:
        clean_sym = (ipo.symbol or "").upper().replace("-EQ", "").strip()
        raw = live_map.get(clean_sym)
        if not raw:
            continue

        sub_dict = raw.get("subscription", {}) or {}
        sub_retail = float(raw.get("subscription_retail") or sub_dict.get("retail") or 0.0)
        sub_shni = float(raw.get("subscription_shni") or sub_dict.get("shni") or 0.0)
        sub_bhni = float(raw.get("subscription_bhni") or sub_dict.get("bhni") or 0.0)
        sub_qib = float(raw.get("subscription_qib") or sub_dict.get("qib") or 0.0)
        sub_total = float(raw.get("subscription_total") or sub_dict.get("total") or 0.0)

        ipo.subscription_retail = sub_retail
        ipo.subscription_shni = sub_shni
        ipo.subscription_bhni = sub_bhni
        ipo.subscription_qib = sub_qib
        ipo.subscription_total = sub_total
        updated += 1
        logger.info(
            f"[Sub-Sync] {ipo.symbol}: QIB={sub_qib}x sHNI={sub_shni}x bHNI={sub_bhni}x "
            f"Retail={sub_retail}x Total={sub_total}x"
        )

    if updated:
        await db.commit()

    logger.info(f"[Sub-Sync] Refreshed {updated}/{len(open_ipos)} open IPO subscription metrics.")
    return updated
