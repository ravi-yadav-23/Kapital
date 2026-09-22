from datetime import datetime, time, date, timezone
from zoneinfo import ZoneInfo
from typing import Optional

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Return current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST)


def is_bidding_window_open(dt: Optional[datetime] = None) -> bool:
    """
    Check if current time is within Indian Stock Exchange ASBA IPO bidding window
    (10:00:00 AM to 05:00:00 PM IST on weekdays, excluding market holidays).
    """
    current = dt.astimezone(IST) if dt else now_ist()
    # Monday = 0, Sunday = 6
    if current.weekday() >= 5:
        return False

    bid_start = time(10, 0, 0)
    bid_end = time(17, 0, 0)
    return bid_start <= current.time() <= bid_end


def is_listing_premarket_window(dt: Optional[datetime] = None) -> bool:
    """
    Check if current time is in NSE/BSE IPO Listing Day pre-market auction window
    (09:00:00 AM to 09:45:00 AM IST on listing day).
    """
    current = dt.astimezone(IST) if dt else now_ist()
    if current.weekday() >= 5:
        return False

    premarket_start = time(9, 0, 0)
    premarket_end = time(9, 45, 0)
    return premarket_start <= current.time() <= premarket_end


def format_ist_date(d: Optional[date]) -> Optional[str]:
    """Format date to standard ISO format string."""
    return d.isoformat() if d else None
