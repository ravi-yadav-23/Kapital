import httpx
import logging
from typing import Dict, Any, List
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


from app.utils.score_engine import IpoScoreEngine


async def fetch_ipos_from_ipoalerts(status: str) -> List[Dict[str, Any]]:
    """Fetch raw IPOs for a given status from ipoalerts.in API."""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(f"{BASE_IPOALERTS_URL}?status={status}")
            if res.status_code == 200:
                data = res.json()
                return data.get("ipos", [])
            else:
                logger.warning(f"ipoalerts.in returned HTTP {res.status_code} for status={status}")
    except Exception as e:
        logger.error(f"Error fetching {status} IPOs from ipoalerts.in: {e}")
    return []


async def sync_ipos_pipeline(db: AsyncSession) -> int:
    """
    Fetch open and upcoming IPOs from public feeds and upsert into PostgreSQL.
    """
    synced_count = 0
    statuses = ["open", "upcoming", "closed"]

    for status in statuses:
        raw_ipos = await fetch_ipos_from_ipoalerts(status)
        for raw in raw_ipos:
            try:
                min_p, max_p = _parse_price_range(raw.get("priceRange", "100-100"))
                lot_sz = int(raw.get("minQty", 1))
                min_inv = float(raw.get("minAmount") or (max_p * lot_sz))
                issue_cr = _parse_issue_size_cr(raw.get("issueSize", "0"))
                
                # Extract real subscription metrics from feed if available
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

                # Extract schedule milestones
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

    await db.commit()
    logger.info(f"IPO sync complete. Total {synced_count} IPOs upserted into PostgreSQL.")
    return synced_count
