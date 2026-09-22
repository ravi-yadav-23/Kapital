from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
import uuid

from app.models.ipo import Ipo, IpoSchedule
from app.schemas.ipo import IpoResponse, IpoScheduleSchema

# In-memory cache synced from DB for fast read access by optimizer
MOCK_IPOS_STORE: List[Dict[str, Any]] = []


def _format_date(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _model_to_response(ipo: Ipo) -> IpoResponse:
    schedules = [
        IpoScheduleSchema(event=s.event, date=_format_date(s.event_date) or "")
        for s in (ipo.schedules or [])
    ]
    return IpoResponse(
        id=ipo.id,
        symbol=ipo.symbol,
        name=ipo.name,
        slug=ipo.slug,
        type=ipo.type or "EQ",
        status=ipo.status or "upcoming",
        logo_url=ipo.logo_url,
        price_band_min=ipo.price_band_min,
        price_band_max=ipo.price_band_max,
        lot_size=ipo.lot_size,
        min_investment=ipo.min_investment,
        issue_size=ipo.issue_size,
        issue_size_cr=ipo.issue_size_cr,
        issue_open_date=_format_date(ipo.issue_open_date) or "",
        issue_close_date=_format_date(ipo.issue_close_date) or "",
        allotment_date=_format_date(ipo.allotment_date),
        refund_date=_format_date(ipo.refund_date),
        listing_date=_format_date(ipo.listing_date),
        about=ipo.about,
        strengths=ipo.strengths or [],
        risks=ipo.risks or [],
        score=ipo.score,
        recommendation=ipo.recommendation,
        gmp_percent=ipo.gmp_percent,
        subscription_retail=ipo.subscription_retail or 0.0,
        subscription_shni=ipo.subscription_shni or 0.0,
        subscription_bhni=ipo.subscription_bhni or 0.0,
        subscription_qib=ipo.subscription_qib or 0.0,
        subscription_total=ipo.subscription_total or 0.0,
        schedule=schedules,
    )


def _model_to_dict(ipo: Ipo) -> Dict[str, Any]:
    res = _model_to_response(ipo)
    data = res.model_dump()
    return data


class IpoService:

    @staticmethod
    async def get_all_ipos(
        db: AsyncSession,
        status: Optional[str] = None,
        ipo_type: Optional[str] = None,
        min_score: Optional[int] = None,
        max_investment: Optional[float] = None,
    ) -> List[IpoResponse]:
        stmt = select(Ipo)

        if status and status != "all":
            stmt = stmt.where(Ipo.status == status)
        if ipo_type and ipo_type != "ALL":
            stmt = stmt.where(Ipo.type == ipo_type)
        if min_score is not None:
            stmt = stmt.where(Ipo.score >= min_score)
        if max_investment is not None:
            stmt = stmt.where(Ipo.min_investment <= max_investment)

        from sqlalchemy import case
        status_order = case(
            (Ipo.status == "open", 1),
            (Ipo.status == "closing_today", 2),
            (Ipo.status == "upcoming", 3),
            else_=4,
        )
        stmt = stmt.order_by(status_order.asc(), Ipo.score.desc().nullslast(), Ipo.issue_close_date.asc().nullslast())
        result = await db.execute(stmt)
        ipos = result.scalars().all()

        # Keep in-memory cache refreshed for optimizer
        MOCK_IPOS_STORE.clear()
        MOCK_IPOS_STORE.extend(_model_to_dict(i) for i in ipos)

        return [_model_to_response(i) for i in ipos]

    @staticmethod
    async def get_ipo_by_id(db: AsyncSession, ipo_id: str) -> Optional[IpoResponse]:
        stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id))
        result = await db.execute(stmt)
        ipo = result.scalar_one_or_none()
        return _model_to_response(ipo) if ipo else None

    @staticmethod
    async def upsert_ipo(db: AsyncSession, ipo_dict: Dict[str, Any]) -> Ipo:
        slug = ipo_dict.get("slug") or ipo_dict.get("symbol", "").lower()
        stmt = select(Ipo).where((Ipo.slug == slug) | (Ipo.symbol == ipo_dict.get("symbol")))
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        def parse_date(val: Any) -> Optional[date]:
            if isinstance(val, date):
                return val
            if isinstance(val, str) and val:
                try:
                    return datetime.strptime(val[:10], "%Y-%m-%d").date()
                except Exception:
                    return None
            return None

        open_dt = parse_date(ipo_dict.get("issue_open_date")) or date.today()
        close_dt = parse_date(ipo_dict.get("issue_close_date")) or date.today()
        allot_dt = parse_date(ipo_dict.get("allotment_date"))
        refund_dt = parse_date(ipo_dict.get("refund_date"))
        listing_dt = parse_date(ipo_dict.get("listing_date"))

        if existing:
            existing.name = ipo_dict.get("name", existing.name)
            existing.status = ipo_dict.get("status", existing.status)
            existing.price_band_min = float(ipo_dict.get("price_band_min", existing.price_band_min))
            existing.price_band_max = float(ipo_dict.get("price_band_max", existing.price_band_max))
            existing.lot_size = int(ipo_dict.get("lot_size", existing.lot_size))
            existing.min_investment = float(ipo_dict.get("min_investment", existing.min_investment))
            new_issue_cr = ipo_dict.get("issue_size_cr")
            if new_issue_cr is not None and float(new_issue_cr) > 0:
                existing.issue_size_cr = float(new_issue_cr)
            elif not existing.issue_size_cr and ipo_dict.get("issue_size"):
                existing.issue_size = ipo_dict.get("issue_size")

            existing.score = ipo_dict.get("score", existing.score)
            existing.recommendation = ipo_dict.get("recommendation", existing.recommendation)
            existing.gmp_percent = ipo_dict.get("gmp_percent", existing.gmp_percent)

            for field in ["subscription_retail", "subscription_shni", "subscription_bhni", "subscription_qib", "subscription_total"]:
                val = ipo_dict.get(field)
                if val is not None and float(val) > 0:
                    setattr(existing, field, float(val))
            await db.flush()
            return existing

        ipo_obj = Ipo(
            id=ipo_dict.get("id") or str(uuid.uuid4()),
            symbol=ipo_dict.get("symbol", "IPO"),
            name=ipo_dict.get("name", "Unknown IPO"),
            slug=slug,
            type=ipo_dict.get("type", "EQ"),
            status=ipo_dict.get("status", "upcoming"),
            logo_url=ipo_dict.get("logo_url"),
            price_band_min=float(ipo_dict.get("price_band_min", 0.0)),
            price_band_max=float(ipo_dict.get("price_band_max", 0.0)),
            lot_size=int(ipo_dict.get("lot_size", 1)),
            min_investment=float(ipo_dict.get("min_investment", 0.0)),
            issue_size=ipo_dict.get("issue_size"),
            issue_size_cr=ipo_dict.get("issue_size_cr"),
            issue_open_date=open_dt,
            issue_close_date=close_dt,
            allotment_date=allot_dt,
            refund_date=refund_dt,
            listing_date=listing_dt,
            about=ipo_dict.get("about"),
            strengths=ipo_dict.get("strengths") or [],
            risks=ipo_dict.get("risks") or [],
            score=ipo_dict.get("score"),
            recommendation=ipo_dict.get("recommendation"),
            gmp_percent=ipo_dict.get("gmp_percent"),
            subscription_retail=float(ipo_dict.get("subscription_retail", 0.0)),
            subscription_shni=float(ipo_dict.get("subscription_shni", 0.0)),
            subscription_bhni=float(ipo_dict.get("subscription_bhni", 0.0)),
            subscription_qib=float(ipo_dict.get("subscription_qib", 0.0)),
            subscription_total=float(ipo_dict.get("subscription_total", 0.0)),
        )
        db.add(ipo_obj)
        await db.flush()

        # Add schedule events if present
        for item in ipo_dict.get("schedule", []):
            evt_date = parse_date(item.get("date"))
            if evt_date:
                sch = IpoSchedule(
                    id=str(uuid.uuid4()),
                    ipo_id=ipo_obj.id,
                    event=item.get("event", "Milestone"),
                    event_date=evt_date,
                )
                db.add(sch)
        await db.flush()
        return ipo_obj


ipo_service = IpoService()
