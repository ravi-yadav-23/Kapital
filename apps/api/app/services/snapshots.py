"""Capture daily GMP / subscription snapshots and listing outcomes from source records."""
from datetime import date
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.snapshots import GmpSnapshot, SubscriptionSnapshot, IpoOutcome

_SUB_FIELDS = (("retail", "subscription_retail"), ("shni", "subscription_shni"), ("bhni", "subscription_bhni"),
               ("qib", "subscription_qib"), ("total", "subscription_total"))


async def capture_snapshots(db: AsyncSession, ipo, rec: Dict[str, Any], source: str) -> None:
    """Record what `source` reported today for `ipo`. Missing quotes create nothing (unknown != 0)."""
    today = date.today()

    gmp = rec.get("gmp_percent")
    if gmp is not None:
        row = (await db.execute(select(GmpSnapshot).where(
            GmpSnapshot.ipo_id == ipo.id, GmpSnapshot.snapshot_date == today, GmpSnapshot.source == source,
        ))).scalar_one_or_none()
        if row is None:
            db.add(GmpSnapshot(ipo_id=ipo.id, snapshot_date=today, source=source,
                               gmp_percent=float(gmp), gmp_rupees=rec.get("gmp_rupees")))
        else:
            row.gmp_percent, row.gmp_rupees = float(gmp), rec.get("gmp_rupees")

    subs = {col: float(rec[key]) for col, key in _SUB_FIELDS if rec.get(key) is not None and float(rec[key]) > 0}
    if subs:
        row = (await db.execute(select(SubscriptionSnapshot).where(
            SubscriptionSnapshot.ipo_id == ipo.id, SubscriptionSnapshot.snapshot_date == today,
            SubscriptionSnapshot.source == source,
        ))).scalar_one_or_none()
        if row is None:
            db.add(SubscriptionSnapshot(ipo_id=ipo.id, snapshot_date=today, source=source, **subs))
        else:
            for col, val in subs.items():
                setattr(row, col, val)

    if rec.get("listing_price") is not None and rec.get("listing_gain_percent") is not None:
        await _record_outcome(db, ipo, rec, source)
    await db.flush()


async def _record_outcome(db: AsyncSession, ipo, rec: Dict[str, Any], source: str) -> None:
    if (await db.execute(select(IpoOutcome).where(IpoOutcome.ipo_id == ipo.id))).scalar_one_or_none():
        return  # the first recorded listing result stands
    last_gmp = (await db.execute(
        select(GmpSnapshot).where(GmpSnapshot.ipo_id == ipo.id).order_by(GmpSnapshot.snapshot_date.desc()).limit(1)
    )).scalar_one_or_none()
    last_sub = (await db.execute(
        select(SubscriptionSnapshot).where(SubscriptionSnapshot.ipo_id == ipo.id, SubscriptionSnapshot.total.isnot(None))
        .order_by(SubscriptionSnapshot.snapshot_date.desc()).limit(1)
    )).scalar_one_or_none()
    db.add(IpoOutcome(
        ipo_id=ipo.id, symbol=ipo.symbol,
        issue_price=ipo.price_band_max or ipo.price_band_min or None,
        listing_price=float(rec["listing_price"]), listing_gain_percent=float(rec["listing_gain_percent"]),
        listing_date=ipo.listing_date, is_sme="true" if ipo.type == "SME" else "false",
        last_gmp_percent=last_gmp.gmp_percent if last_gmp else None,
        last_subscription_total=last_sub.total if last_sub else None,
        source=source,
    ))
