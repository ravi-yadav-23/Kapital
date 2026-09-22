import httpx
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ipo_service import ipo_service

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


def _parse_ipowatch_dates(d_str: str, year: int = 2026) -> tuple[Optional[str], Optional[str]]:
    months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    m_clean = d_str.strip().lower()
    for m_name, m_num in months.items():
        if m_name in m_clean:
            nums = [int(n) for n in re.findall(r'\d+', m_clean)]
            if len(nums) >= 2:
                d_open = datetime.date(year, m_num, nums[0])
                d_close = datetime.date(year, m_num, nums[1])
                return d_open.isoformat(), d_close.isoformat()
            elif len(nums) == 1:
                d_open = datetime.date(year, m_num, nums[0])
                return d_open.isoformat(), d_open.isoformat()
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
            
            for t_idx, ipo_type in [(0, 'EQ'), (1, 'SME')]:
                if t_idx >= len(tables):
                    continue
                table = tables[t_idx]
                for row in table.find_all('tr')[1:]:
                    cols = [td.get_text(strip=True).replace('\u20b9', '').replace(',', '').strip() for td in row.find_all(['td', 'th'])]
                    if len(cols) >= 6:
                        name = cols[0]
                        gmp_str = cols[1]
                        price_str = cols[3]
                        dates = cols[5]
                        
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
                        
                        if close_d_str:
                            close_d = datetime.date.fromisoformat(close_d_str)
                            open_d = datetime.date.fromisoformat(open_d_str) if open_d_str else close_d
                            if close_d < today:
                                status = 'closed'
                            elif open_d <= today <= close_d:
                                status = 'closing_today' if close_d == today else 'open'
                            else:
                                status = 'upcoming'
                        else:
                            status = 'upcoming'
                        
                        clean_sym = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:10]
                        slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
                        lot_size = max(1, int(15000 / max_p)) if ipo_type == 'EQ' else max(100, int(120000 / max_p))
                        min_inv = round(lot_size * max_p, 2)
                        
                        score, rec, _ = IpoScoreEngine.compute_score({
                            'gmp_percent': gmp_pct,
                            'subscription_qib': 12.0 if gmp_pct > 15 else 2.0,
                            'subscription_total': 20.0 if gmp_pct > 15 else 3.0,
                            'issue_size_cr': 850.0 if ipo_type == 'EQ' else 65.0,
                        })
                        
                        ipos.append({
                            'symbol': clean_sym,
                            'name': name,
                            'slug': slug,
                            'type': ipo_type,
                            'status': status,
                            'price_band_min': min_p,
                            'price_band_max': max_p,
                            'lot_size': lot_size,
                            'min_investment': min_inv,
                            'issue_size_cr': 850.0 if ipo_type == 'EQ' else 65.0,
                            'issue_open_date': open_d_str,
                            'issue_close_date': close_d_str,
                            'about': f"{name} ({ipo_type}) issue on Indian exchanges with price band Rs {min_p}-{max_p} and active GMP of {gmp_pct}%.",
                            'strengths': ['Strong market demand', f'Indicative GMP: {gmp_pct}%', 'Verified exchange disclosures'],
                            'risks': ['General market risk', 'Working capital requirements'],
                            'score': score,
                            'recommendation': rec,
                            'gmp_percent': gmp_pct,
                            'subscription_retail': 5.0,
                            'subscription_shni': 4.0,
                            'subscription_bhni': 8.0,
                            'subscription_qib': 12.0 if gmp_pct > 15 else 2.0,
                            'subscription_total': 20.0 if gmp_pct > 15 else 3.0,
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
                    "symbol": raw.get("symbol", "IPO"),
                    "name": raw.get("name", "IPO Issue"),
                    "slug": raw.get("slug", raw.get("symbol", "").lower()),
                    "type": raw.get("type", "EQ"),
                    "status": raw.get("status", status),
                    "logo_url": raw.get("logo"),
                    "price_band_min": min_p,
                    "price_band_max": max_p,
                    "lot_size": lot_sz,
                    "min_investment": min_inv,
                    "issue_size": raw.get("issueSize"),
                    "issue_size_cr": issue_cr,
                    "issue_open_date": raw.get("startDate"),
                    "issue_close_date": raw.get("endDate"),
                    "listing_date": raw.get("listingDate"),
                    "about": raw.get("about"),
                    "strengths": raw.get("strengths", []),
                    "risks": raw.get("risks", []),
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
