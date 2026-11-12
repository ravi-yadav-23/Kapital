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

async def fetch_ipos_from_groww() -> List[Dict[str, Any]]:
    """
    Fetch authoritative IPO ground truth directly from Groww's SSR payload:
    - Authoritative symbols, ISINs, official names, logos
    - Exact bid timestamps converted to IST dates (YYYY-MM-DD)
    - True exchange-verified SME vs Mainboard indicator (isSme -> 'SME' vs 'EQ')
    - Price bands, lot sizes, tick sizes
    - Exchange-level overall subscription multiples
    - Ingests openDataList, upcomingDataList, and recent closedDataList
    """
    url = "https://groww.in/ipo"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    ipos = []
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
            res = await client.get(url)
            if res.status_code != 200:
                logger.warning(f"Groww returned HTTP {res.status_code}")
                return []

            soup = BeautifulSoup(res.text, "html.parser")
            next_data_tag = soup.find("script", id="__NEXT_DATA__")
            if not next_data_tag or not next_data_tag.string:
                logger.warning("No __NEXT_DATA__ found in Groww page")
                return []

            page_props = json.loads(next_data_tag.string).get("props", {}).get("pageProps", {})
            open_list = page_props.get("openDataList", [])
            upcoming_list = page_props.get("upcomingDataList", [])
            closed_list = page_props.get("closedDataList", [])

            ist = ZoneInfo("Asia/Kolkata")

            # 1. Open and Pre-Apply IPOs
            for item in open_list:
                try:
                    name = clean_text(item.get("companyName", ""))
                    if not name:
                        continue
                    sym = clean_text(item.get("symbol", "")).upper()
                    is_sme = bool(item.get("isSme", False))
                    ipo_type = "SME" if is_sme else "EQ"
                    isin = item.get("isin")
                    logo_url = item.get("logoUrl")
                    sub_total = float(item.get("overallSubscription") or 0.0)

                    s_ts = item.get("bidStartTimestamp")
                    e_ts = item.get("bidEndTimestamp")
                    open_d = datetime.datetime.fromtimestamp(s_ts / 1000, tz=ist).strftime("%Y-%m-%d") if s_ts else None
                    close_d = datetime.datetime.fromtimestamp(e_ts / 1000, tz=ist).strftime("%Y-%m-%d") if e_ts else None

                    cats = item.get("categories") or [{}]
                    min_p = float(cats[0].get("minPrice") or 0.0)
                    max_p = float(cats[0].get("maxPrice") or min_p or 100.0)
                    lot = int(cats[0].get("lotSize") or (1000 if is_sme else 1))
                    if is_sme and (lot * max_p) < 200000.0 and (lot * max_p) > 0:
                        min_lots = max(2, int(200000.0 / (lot * max_p)) + (1 if 200000.0 % (lot * max_p) != 0 else 0))
                        min_inv = round(min_lots * lot * max_p, 2)
                    else:
                        min_inv = round(lot * max_p, 2)

                    status = compute_ipo_status(open_d, close_d)
                    slug = item.get("searchId") or re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()

                    score, rec, _ = IpoScoreEngine.compute_score({
                        "gmp_percent": 0.0,
                        "subscription_qib": 0.0,
                        "subscription_total": sub_total,
                        "issue_size_cr": 0.0,
                    })

                    ipos.append({
                        "symbol": sym,
                        "isin": isin,
                        "name": name,
                        "slug": slug,
                        "type": ipo_type,
                        "status": status,
                        "logo_url": logo_url,
                        "price_band_min": min_p,
                        "price_band_max": max_p,
                        "lot_size": lot,
                        "min_investment": min_inv,
                        "issue_size": "",
                        "issue_size_cr": 0.0,
                        "issue_open_date": open_d,
                        "issue_close_date": close_d,
                        "about": f"{name} ({ipo_type}) offering on Indian exchanges with price band Rs {min_p}-{max_p} and lot size of {lot} shares.",
                        "strengths": clean_text_list(["SEBI/Exchange verified offering", f"Subscription momentum: {sub_total}x"]),
                        "risks": clean_text_list(["Working capital requirements", "General equity market risk"]),
                        "score": score,
                        "recommendation": rec,
                        "gmp_percent": 0.0,
                        "subscription_retail": 0.0,
                        "subscription_shni": 0.0,
                        "subscription_bhni": 0.0,
                        "subscription_qib": 0.0,
                        "subscription_total": sub_total,
                        "is_groww_feed": True,
                    })
                except Exception as ex:
                    logger.warning(f"Error parsing Groww open IPO {item.get('symbol')}: {ex}")

            # 2. Upcoming IPOs
            for item in upcoming_list:
                try:
                    name = clean_text(item.get("companyName", ""))
                    if not name:
                        continue
                    sym = clean_text(item.get("symbol", "")).upper()
                    is_sme = bool(item.get("isSme", False))
                    ipo_type = "SME" if is_sme else "EQ"
                    logo_url = item.get("logoUrl")

                    s_ts = item.get("bidStartTimestamp")
                    e_ts = item.get("bidEndTimestamp")
                    open_d = datetime.datetime.fromtimestamp(s_ts / 1000, tz=ist).strftime("%Y-%m-%d") if s_ts else None
                    close_d = datetime.datetime.fromtimestamp(e_ts / 1000, tz=ist).strftime("%Y-%m-%d") if e_ts else None
                    slug = item.get("searchId") or re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()

                    ipos.append({
                        "symbol": sym,
                        "name": name,
                        "slug": slug,
                        "type": ipo_type,
                        "status": "upcoming",
                        "logo_url": logo_url,
                        "price_band_min": 100.0,
                        "price_band_max": 100.0,
                        "lot_size": 1000 if is_sme else 15,
                        "min_investment": 15000.0 if not is_sme else 100000.0,
                        "issue_size_cr": 0.0,
                        "issue_open_date": open_d,
                        "issue_close_date": close_d,
                        "about": f"{name} ({ipo_type}) upcoming issue.",
                        "strengths": clean_text_list(["Filed draft red herring prospectus (DRHP)"]),
                        "risks": clean_text_list(["Pre-issue market volatility"]),
                        "score": 50,
                        "recommendation": "WATCH",
                        "gmp_percent": 0.0,
                        "subscription_total": 0.0,
                        "is_groww_feed": True,
                    })
                except Exception as ex:
                    logger.warning(f"Error parsing Groww upcoming IPO {item.get('symbol')}: {ex}")

            # 3. Recent Closed IPOs (keep the latest 30 closed IPOs to ensure historical data & analysis are preserved)
            for item in closed_list[:30]:
                try:
                    name = clean_text(item.get("companyName", ""))
                    if not name:
                        continue
                    sym = clean_text(item.get("symbol", "")).upper()
                    is_sme = bool(item.get("isSme", False))
                    ipo_type = "SME" if is_sme else "EQ"
                    logo_url = item.get("logoUrl")
                    sub_total = float(item.get("overallSubscription") or 0.0)
                    issue_p = float(item.get("issuePrice") or 100.0)
                    open_d = item.get("openingDate")
                    close_d = item.get("closingDate")
                    allot_d = item.get("allotmentDate")
                    # Heal corrupted Groww closingDate (Groww sometimes populates closingDate with listingDate)
                    if allot_d and close_d and close_d > allot_d:
                        close_d = allot_d
                    list_ts = item.get("listingTimestamp")
                    list_d = datetime.datetime.fromtimestamp(list_ts / 1000, tz=ist).strftime("%Y-%m-%d") if list_ts else None
                    slug = item.get("searchId") or re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()

                    lot = 1000 if is_sme else max(1, int(15000 / issue_p))
                    min_inv = round(lot * issue_p, 2)

                    score, rec, _ = IpoScoreEngine.compute_score({
                        "gmp_percent": 0.0,
                        "subscription_qib": 0.0,
                        "subscription_total": sub_total,
                        "issue_size_cr": 0.0,
                    })

                    ipos.append({
                        "symbol": sym,
                        "name": name,
                        "slug": slug,
                        "type": ipo_type,
                        "status": "closed",
                        "logo_url": logo_url,
                        "price_band_min": issue_p,
                        "price_band_max": issue_p,
                        "lot_size": lot,
                        "min_investment": min_inv,
                        "issue_size_cr": 0.0,
                        "issue_open_date": open_d,
                        "issue_close_date": close_d,
                        "allotment_date": allot_d,
                        "listing_date": list_d,
                        "about": f"{name} ({ipo_type}) closed issue with final issue price Rs {issue_p} and {sub_total}x total subscription.",
                        "strengths": clean_text_list(["Closed issue with complete bidding history", f"Final subscription: {sub_total}x"]),
                        "risks": clean_text_list(["Post-listing volatility"]),
                        "score": score,
                        "recommendation": rec,
                        "gmp_percent": 0.0,
                        "subscription_total": sub_total,
                        "is_groww_feed": True,
                    })
                except Exception as ex:
                    logger.warning(f"Error parsing Groww closed IPO {item.get('symbol')}: {ex}")

    except Exception as e:
        logger.error(f"Error fetching IPOs from Groww: {e}")
    return ipos


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
