import calendar
from datetime import datetime, time, date, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Any

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Return current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST)


def today_ist() -> date:
    """Return today's date in Indian Standard Time (IST)."""
    return now_ist().date()


def parse_to_date(val: Any) -> Optional[date]:
    """Parse date, datetime, or string to standard date object."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str) and val.strip():
        s = val.strip()[:10]
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            try:
                return datetime.strptime(s, "%Y-%m-%d").date()
            except Exception:
                return None
    return None


def normalize_ipo_dates(
    open_date: Any,
    close_date: Any,
) -> tuple[Optional[date], Optional[date]]:
    """
    Parse and sanitize open and close dates.
    Self-heals inverted cross-month dates (e.g. 2026-11-30 to 2026-11-03 becomes 2026-10-30 to 2026-11-03).
    """
    d_open = parse_to_date(open_date)
    d_close = parse_to_date(close_date)

    if d_open and d_close and d_open > d_close:
        # Check if single-month parse caused rollover inversion (day_open > day_close)
        if d_open.day > d_close.day and d_open.month == d_close.month and d_open.year == d_close.year:
            if d_open.month > 1:
                try:
                    d_open = d_open.replace(month=d_open.month - 1)
                except ValueError:
                    last_day = calendar.monthrange(d_open.year, d_open.month - 1)[1]
                    d_open = d_open.replace(month=d_open.month - 1, day=min(d_open.day, last_day))
            else:
                try:
                    d_open = d_open.replace(year=d_open.year - 1, month=12)
                except ValueError:
                    pass
        elif d_open > d_close:
            # If still inverted for any other reason, swap them to prevent impossible issue windows
            d_open, d_close = d_close, d_open

    return d_open, d_close


def compute_ipo_status(
    open_date: Any,
    close_date: Any,
    today: Optional[date] = None,
) -> str:
    """
    Single canonical source of truth for IPO status across backend, tasks, and API read paths.
    Returns: 'upcoming', 'open', 'closing_today', or 'closed'.
    """
    if today is None:
        today = today_ist()

    d_open, d_close = normalize_ipo_dates(open_date, close_date)

    if not d_close:
        return "upcoming"

    if d_close < today:
        return "closed"

    if d_close == today:
        return "closing_today"

    if d_open and today < d_open:
        return "upcoming"

    if d_open and d_open <= today <= d_close:
        return "open"

    if not d_open and today <= d_close:
        return "open"

    return "upcoming"


# Official NSE/BSE Indian Capital Market Trading Holidays (2024 - 2026)
NSE_TRADING_HOLIDAYS = {
    # 2024
    date(2024, 1, 22), date(2024, 1, 26), date(2024, 3, 8), date(2024, 3, 25),
    date(2024, 4, 11), date(2024, 4, 17), date(2024, 5, 1), date(2024, 5, 20),
    date(2024, 6, 17), date(2024, 7, 17), date(2024, 8, 15), date(2024, 10, 2),
    date(2024, 11, 1), date(2024, 11, 15), date(2024, 12, 25),
    # 2025
    date(2025, 1, 26), date(2025, 2, 26), date(2025, 3, 14), date(2025, 3, 31),
    date(2025, 4, 10), date(2025, 4, 14), date(2025, 4, 18), date(2025, 5, 1),
    date(2025, 6, 7), date(2025, 8, 15), date(2025, 8, 27), date(2025, 10, 2),
    date(2025, 10, 21), date(2025, 10, 22), date(2025, 11, 5), date(2025, 12, 25),
    # 2026
    date(2026, 1, 26), date(2026, 2, 16), date(2026, 3, 3), date(2026, 3, 20),
    date(2026, 4, 3), date(2026, 4, 14), date(2026, 5, 1), date(2026, 5, 27),
    date(2026, 6, 26), date(2026, 8, 15), date(2026, 10, 2), date(2026, 10, 20),
    date(2026, 11, 8), date(2026, 11, 24), date(2026, 12, 25),
}


def is_trading_day(d: date) -> bool:
    """Returns True if date is a weekday and not an official NSE/BSE stock exchange holiday."""
    if d.weekday() >= 5:  # Saturday or Sunday
        return False
    return d not in NSE_TRADING_HOLIDAYS


def calculate_listing_date(close_date: Any) -> Optional[date]:
    """
    SEBI mandate: Listing occurs T+3 working trading days after issue close date.
    Skips weekends (Saturday, Sunday) and official stock exchange trading holidays.
    """
    d_close = parse_to_date(close_date)
    if not d_close:
        return None
    cur = d_close
    added_days = 0
    while added_days < 3:
        cur += timedelta(days=1)
        if is_trading_day(cur):
            added_days += 1
    return cur


def is_bidding_window_open(dt: Optional[datetime] = None) -> bool:
    """
    Check if current time is within Indian Stock Exchange ASBA IPO bidding window
    (10:00:00 AM to 05:00:00 PM IST on trading days, excluding weekends and market holidays).
    """
    current = dt.astimezone(IST) if dt else now_ist()
    if not is_trading_day(current.date()):
        return False

    bid_start = time(10, 0, 0)
    bid_end = time(17, 0, 0)
    return bid_start <= current.time() <= bid_end


def is_listing_premarket_window(dt: Optional[datetime] = None) -> bool:
    """
    Check if current time is in NSE/BSE IPO Listing Day pre-market auction window
    (09:00:00 AM to 09:45:00 AM IST on listing trading day).
    """
    current = dt.astimezone(IST) if dt else now_ist()
    if not is_trading_day(current.date()):
        return False

    premarket_start = time(9, 0, 0)
    premarket_end = time(9, 45, 0)
    return premarket_start <= current.time() <= premarket_end


def format_ist_date(d: Optional[date]) -> Optional[str]:
    """Format date to standard ISO format string."""
    return d.isoformat() if d else None

