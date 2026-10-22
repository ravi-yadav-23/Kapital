from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
import uuid

from app.models.ipo import Ipo, IpoSchedule, IpoAlias
from app.schemas.ipo import IpoResponse, IpoScheduleSchema
from app.schemas.report import ScoreBreakdownSchema, RedFlagSchema
from app.utils.text_utils import clean_text, clean_text_list
import re



def normalize_entity_name(name: str) -> str:
    """Normalize company name to canonical stem: lowercase, remove legal suffixes, remove non-alphanumerics."""
    if not name:
        return ""
    # Remove common legal suffixes and words
    cleaned = re.sub(r'\b(ltd|limited|india|pvt|private|corporation|corp|enterprises|industries)\b', '', name, flags=re.IGNORECASE)
    # Remove non-alphanumerics
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', cleaned).lower()
    return cleaned


def _format_date(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _model_to_response(ipo: Ipo) -> IpoResponse:
    schedules = [
        IpoScheduleSchema(event=s.event, date=_format_date(s.event_date) or "")
        for s in (ipo.schedules or [])
    ]
    score_breakdown = None
    red_flags = []
    if getattr(ipo, "report", None):
        rep = ipo.report
        score_breakdown = ScoreBreakdownSchema(
            financial_quality=rep.score_financial_quality or 0,
            industry_tailwinds=rep.score_industry_tailwinds or 0,
            subscription_momentum=rep.score_subscription_momentum or 0,
            valuation_safety=rep.score_valuation_safety or 0,
            gmp_strength=rep.score_gmp_strength or 0,
            promoter_integrity=rep.score_promoter_integrity or 0,
        )
        red_flags = [RedFlagSchema(**rf) if isinstance(rf, dict) else rf for rf in (rep.red_flags or [])]

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
        score_breakdown=score_breakdown,
        red_flags=red_flags,
    )




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

        if not ipos:
            from sqlalchemy import func
            total_ipos = await db.scalar(select(func.count(Ipo.id)))
            if not total_ipos:
                from app.tasks.ipo_tasks import sync_ipos_pipeline
                await sync_ipos_pipeline(db)
                result = await db.execute(stmt)
                ipos = result.scalars().all()


        return [_model_to_response(i) for i in ipos]

    @staticmethod
    async def get_ipo_by_id(db: AsyncSession, ipo_id: str) -> Optional[IpoResponse]:
        stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
        result = await db.execute(stmt)
        ipo = result.scalar_one_or_none()

        if not ipo:
            from sqlalchemy import func
            total_ipos = await db.scalar(select(func.count(Ipo.id)))
            if not total_ipos:
                from app.tasks.ipo_tasks import sync_ipos_pipeline
                await sync_ipos_pipeline(db)
                result = await db.execute(stmt)
                ipo = result.scalar_one_or_none()

        return _model_to_response(ipo) if ipo else None


    @staticmethod
    async def upsert_ipo(db: AsyncSession, ipo_dict: Dict[str, Any]) -> Ipo:
        """
        Multi-Tier Entity Resolution Pipeline:
        - Tier 1: Absolute Match by ISIN or official Symbol
        - Tier 2: Explicit Database Alias Mapping Table (ipo_aliases)
        - Tier 3: Canonical Stem Matching & Self-Learning Alias Registration
        """
        raw_name = ipo_dict.get("name", "").strip()
        incoming_slug = ipo_dict.get("slug") or ipo_dict.get("symbol", "").lower()
        incoming_symbol = ipo_dict.get("symbol")
        incoming_isin = ipo_dict.get("isin")
        is_secondary = ipo_dict.get("is_secondary_feed", False)
        norm_key = normalize_entity_name(raw_name)

        existing: Optional[Ipo] = None

        # ── Tier 1: Absolute Match (ISIN or authentic Symbol) ──────────
        if incoming_isin:
            stmt_isin = select(Ipo).where(Ipo.isin == incoming_isin)
            res_isin = await db.execute(stmt_isin)
            existing = res_isin.scalar_one_or_none()

        if not existing and incoming_symbol and not is_secondary:
            stmt_sym = select(Ipo).where(Ipo.symbol == incoming_symbol)
            res_sym = await db.execute(stmt_sym)
            existing = res_sym.scalar_one_or_none()

        if not existing and incoming_slug and not is_secondary:
            stmt_slug = select(Ipo).where(Ipo.slug == incoming_slug)
            res_slug = await db.execute(stmt_slug)
            existing = res_slug.scalar_one_or_none()

        # ── Tier 2: Explicit Alias Mapping Table (ipo_aliases) ─────────
        if not existing and norm_key:
            stmt_alias = (
                select(Ipo)
                .join(IpoAlias, Ipo.id == IpoAlias.ipo_id)
                .where(IpoAlias.normalized_alias == norm_key)
            )
            res_alias = await db.execute(stmt_alias)
            existing = res_alias.scalar_one_or_none()

        # ── Tier 3: Canonical Stem Auto-Discovery & Self-Learning ──────
        if not existing and norm_key:
            res_all = await db.execute(select(Ipo))
            for cand in res_all.scalars().all():
                cand_norm = normalize_entity_name(cand.name)
                if cand_norm and cand_norm == norm_key:
                    existing = cand
                    # Auto-register this variation in Tier 2 alias table!
                    try:
                        new_alias = IpoAlias(
                            id=str(uuid.uuid4()),
                            ipo_id=existing.id,
                            alias=raw_name,
                            normalized_alias=norm_key,
                            source="ipowatch" if is_secondary else "ipoalerts",
                        )
                        db.add(new_alias)
                        await db.flush()
                    except Exception:
                        pass
                    break

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

        # ── Merge and Enrich Existing Record ───────────────────────────
        if existing:
            # Preserve primary authentic official name if secondary feed has shorter name
            if not is_secondary:
                existing.name = raw_name
            if ipo_dict.get("status"):
                existing.status = ipo_dict.get("status")
            if ipo_dict.get("price_band_min") and float(ipo_dict.get("price_band_min")) > 0:
                existing.price_band_min = float(ipo_dict.get("price_band_min"))
            if ipo_dict.get("price_band_max") and float(ipo_dict.get("price_band_max")) > 0:
                existing.price_band_max = float(ipo_dict.get("price_band_max"))

            # Protect authentic lot size from heuristic/secondary feed overwrite
            incoming_lot = int(ipo_dict.get("lot_size", 0))
            if incoming_lot > 0:
                if existing.lot_size and existing.lot_size > 1 and is_secondary:
                    pass  # Preserve authentic exchange lot size
                else:
                    existing.lot_size = incoming_lot
                    existing.min_investment = float(ipo_dict.get("min_investment") or (existing.price_band_max * incoming_lot))

            new_issue_cr = ipo_dict.get("issue_size_cr")
            if new_issue_cr is not None and float(new_issue_cr) > 0:
                existing.issue_size_cr = float(new_issue_cr)
            elif not existing.issue_size_cr and ipo_dict.get("issue_size"):
                existing.issue_size = ipo_dict.get("issue_size")

            existing.score = ipo_dict.get("score", existing.score)
            existing.recommendation = ipo_dict.get("recommendation", existing.recommendation)
            if ipo_dict.get("gmp_percent") is not None:
                existing.gmp_percent = float(ipo_dict.get("gmp_percent"))

            for field in ["subscription_retail", "subscription_shni", "subscription_bhni", "subscription_qib", "subscription_total"]:
                val = ipo_dict.get(field)
                if val is not None and float(val) > 0:
                    setattr(existing, field, float(val))

            # Ensure this alias is recorded in Tier 2
            if norm_key:
                try:
                    stmt_check = select(IpoAlias).where(IpoAlias.normalized_alias == norm_key)
                    if not (await db.execute(stmt_check)).scalar_one_or_none():
                        db.add(IpoAlias(
                            id=str(uuid.uuid4()),
                            ipo_id=existing.id,
                            alias=raw_name,
                            normalized_alias=norm_key,
                            source="ipowatch" if is_secondary else "ipoalerts",
                        ))
                except Exception:
                    pass

            if ipo_dict.get("about"):
                cleaned_about = clean_text(ipo_dict.get("about"))
                if cleaned_about:
                    existing.about = cleaned_about
            if ipo_dict.get("strengths"):
                existing.strengths = clean_text_list(ipo_dict.get("strengths"))
            if ipo_dict.get("risks"):
                existing.risks = clean_text_list(ipo_dict.get("risks"))

            await db.flush()
            return existing

        # ── Insert Brand New Master Record ─────────────────────────────
        new_id = ipo_dict.get("id") or str(uuid.uuid4())
        ipo_obj = Ipo(
            id=new_id,
            isin=incoming_isin,
            symbol=ipo_dict.get("symbol", "IPO"),
            name=raw_name,
            slug=incoming_slug,
            type=ipo_dict.get("type", "EQ"),
            status=ipo_dict.get("status", "upcoming"),
            logo_url=ipo_dict.get("logo_url"),
            price_band_min=float(ipo_dict.get("price_band_min", 0.0)),
            price_band_max=float(ipo_dict.get("price_band_max", 0.0)),
            lot_size=int(ipo_dict.get("lot_size", 1)),
            min_investment=float(ipo_dict.get("min_investment", 0.0)),
            issue_size=clean_text(ipo_dict.get("issue_size")),
            issue_size_cr=ipo_dict.get("issue_size_cr"),
            issue_open_date=open_dt,
            issue_close_date=close_dt,
            allotment_date=allot_dt,
            refund_date=refund_dt,
            listing_date=listing_dt,
            about=clean_text(ipo_dict.get("about")),
            strengths=clean_text_list(ipo_dict.get("strengths") or []),
            risks=clean_text_list(ipo_dict.get("risks") or []),
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

        # Register primary alias in Tier 2
        if norm_key:
            try:
                db.add(IpoAlias(
                    id=str(uuid.uuid4()),
                    ipo_id=ipo_obj.id,
                    alias=raw_name,
                    normalized_alias=norm_key,
                    source="ipoalerts" if not is_secondary else "ipowatch",
                ))
            except Exception:
                pass

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
