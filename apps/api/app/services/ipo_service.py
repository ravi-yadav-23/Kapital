from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
import uuid

from app.models.ipo import Ipo, IpoSchedule, IpoAlias
from app.schemas.ipo import IpoResponse, IpoScheduleSchema
from app.schemas.report import ScoreBreakdownSchema, RedFlagSchema
from app.utils.text_utils import clean_text, clean_text_list
from app.utils.date_utils import compute_ipo_status, today_ist, normalize_ipo_dates
from sqlalchemy.orm import selectinload
import re



import difflib

# Standard stop words and legal entities for financial markets
LEGAL_STOP_WORDS = {
    'ltd', 'limited', 'india', 'pvt', 'private', 'corporation', 'corp', 'inc', 'incorporated', 'co', 'company'
}

def extract_meaningful_tokens(name: str) -> list[str]:
    """Tokenize and remove non-alphanumeric noise and legal suffixes."""
    if not name:
        return []
    words = re.findall(r'[a-zA-Z0-9]+', name.lower())
    return [w for w in words if w not in LEGAL_STOP_WORDS]

def normalize_entity_name(name: str) -> str:
    """Standard stem of company name."""
    tokens = extract_meaningful_tokens(name)
    return ''.join(tokens)

def compute_entity_similarity(
    name1: str,
    name2: str,
    price1: Optional[float] = None,
    price2: Optional[float] = None,
) -> tuple[bool, float]:
    """
    Production-grade multi-signal entity matching algorithm:
    1. Token Containment: Handles truncated titles (e.g. 'Vedant Poly Fabs' vs 'Vedant Poly Fabs Solutions').
    2. Sequence Similarity: Character-level Levenshtein/Gestalt matching.
    3. Distinctiveness Guard: Prevents false positives across conglomerates (e.g. 'Tata Motors' vs 'Tata Steel').
    4. Market Metadata Confirmation: Validates price band alignment if available.
    """
    t1 = set(extract_meaningful_tokens(name1))
    t2 = set(extract_meaningful_tokens(name2))
    if not t1 or not t2:
        return False, 0.0

    common = t1 & t2
    min_tokens = min(len(t1), len(t2))
    containment = len(common) / min_tokens if min_tokens > 0 else 0.0

    s1_clean = ' '.join(extract_meaningful_tokens(name1))
    s2_clean = ' '.join(extract_meaningful_tokens(name2))
    seq_ratio = difflib.SequenceMatcher(None, s1_clean, s2_clean).ratio()

    # Base match score
    score = max(containment, seq_ratio)

    # Conglomerate collision guard:
    # If only 1 generic brand token matches (e.g. 'Tata', 'Reliance', 'Adani', 'BLS') but the companies
    # have multiple tokens, require high sequence similarity to prevent merging sister subsidiaries.
    if len(common) <= 1 and min_tokens > 1:
        return False, score

    # Market metadata confirmation: Check if issue prices match within 15%
    price_aligned = False
    if price1 and price2 and price1 > 0 and price2 > 0:
        if abs(price1 - price2) / max(price1, price2) <= 0.15:
            price_aligned = True

    # Decisive match criteria:
    # A) All core tokens of the shorter name are present in the longer name (>= 2 tokens)
    # B) Overall text sequence similarity >= 80%
    # C) Token containment >= 70% corroborated by matching issue prices
    if (containment >= 0.85 and len(common) >= 2) or (seq_ratio >= 0.80) or (containment >= 0.70 and price_aligned):
        return True, score

    return False, score


def _format_date(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _model_to_response(ipo: Ipo) -> IpoResponse:
    schedules = [
        IpoScheduleSchema(event=s.event, date=_format_date(s.event_date) or "")
        for s in (ipo.schedules or [])
    ]

    # Status & Dates: Always normalized and computed via the single canonical function in IST
    d_open, d_close = normalize_ipo_dates(ipo.issue_open_date, ipo.issue_close_date)
    effective_status = compute_ipo_status(d_open, d_close)

    # Score: One single source of truth across Dashboard, IPO Board, and Reports
    has_audit = bool(getattr(ipo, "report", None))
    if has_audit:
        rep = ipo.report
        score = rep.overall_score
        recommendation = rep.recommendation
        is_audited = True
        score_breakdown = ScoreBreakdownSchema(
            financial_quality=rep.score_financial_quality,
            industry_tailwinds=rep.score_industry_tailwinds,
            subscription_momentum=rep.score_subscription_momentum,
            valuation_safety=rep.score_valuation_safety,
            gmp_strength=rep.score_gmp_strength,
            promoter_integrity=rep.score_promoter_integrity,
        )
        red_flags = [RedFlagSchema(**rf) if isinstance(rf, dict) else rf for rf in (rep.red_flags or [])]
    else:
        # Canonical preliminary rating from live data: exactly matches build_fallback_report_response
        gmp = float(ipo.gmp_percent or 0.0)
        sub_total = float(ipo.subscription_total or 0.0)
        if gmp >= 50.0:
            gmp_strength = min(100, int(80 + (gmp - 50) * 0.4))
        elif gmp >= 20.0:
            gmp_strength = int(60 + (gmp - 20) * (20 / 30))
        elif gmp >= 5.0:
            gmp_strength = int(40 + (gmp - 5) * (20 / 15))
        elif gmp >= 0.0:
            gmp_strength = int(25 + gmp * 3)
        else:
            gmp_strength = max(0, int(25 + gmp))

        if sub_total >= 20.0:
            subscription_momentum = min(100, int(80 + (sub_total - 20) * 0.5))
        elif sub_total >= 5.0:
            subscription_momentum = int(60 + (sub_total - 5) * (20 / 15))
        elif sub_total >= 1.0:
            subscription_momentum = int(40 + (sub_total - 1) * 5)
        else:
            subscription_momentum = 30

        score = int(round(gmp_strength * 0.60 + subscription_momentum * 0.40))
        recommendation = ipo.recommendation or ("STRONG_APPLY" if score >= 80 else "MODERATE_APPLY" if score >= 60 else "WATCH" if score >= 45 else "AVOID")
        is_audited = False
        score_breakdown = ScoreBreakdownSchema(
            financial_quality=None,
            industry_tailwinds=None,
            subscription_momentum=subscription_momentum,
            valuation_safety=None,
            gmp_strength=gmp_strength,
            promoter_integrity=None,
        )
        red_flags = []

    return IpoResponse(
        id=ipo.id,
        symbol=ipo.symbol,
        name=ipo.name,
        slug=ipo.slug,
        type=ipo.type or "EQ",
        status=effective_status,
        logo_url=ipo.logo_url,
        price_band_min=ipo.price_band_min,
        price_band_max=ipo.price_band_max,
        lot_size=ipo.lot_size,
        min_investment=ipo.min_investment,
        issue_size=ipo.issue_size,
        issue_size_cr=ipo.issue_size_cr,
        issue_open_date=_format_date(d_open) or "",
        issue_close_date=_format_date(d_close) or "",
        allotment_date=_format_date(ipo.allotment_date),
        refund_date=_format_date(ipo.refund_date),
        listing_date=_format_date(ipo.listing_date),
        about=ipo.about,
        strengths=ipo.strengths or [],
        risks=ipo.risks or [],
        score=score,
        is_audited=is_audited,
        recommendation=recommendation,
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
        stmt = select(Ipo).options(selectinload(Ipo.report), selectinload(Ipo.schedules))

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

        responses = [_model_to_response(i) for i in ipos]
        if status and status != "all":
            responses = [r for r in responses if r.status == status]

        return responses

    @staticmethod
    async def get_ipo_by_id(db: AsyncSession, ipo_id: str) -> Optional[IpoResponse]:
        stmt = (
            select(Ipo)
            .options(selectinload(Ipo.report), selectinload(Ipo.schedules))
            .where((Ipo.id == ipo_id) | (Ipo.slug == ipo_id) | (Ipo.symbol == ipo_id.upper()))
        )
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
        is_groww = ipo_dict.get("is_groww_feed", False)
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

        # ── Tier 3: Multi-Signal Entity Resolution & Auto-Discovery ──────────
        if not existing and raw_name:
            res_all = await db.execute(select(Ipo))
            all_candidates = res_all.scalars().all()
            
            incoming_price = float(ipo_dict.get("price_band_max") or ipo_dict.get("price_band_min") or 0.0)

            # 3A. Direct Stem Equality
            for cand in all_candidates:
                cand_norm = normalize_entity_name(cand.name)
                if cand_norm and cand_norm == norm_key:
                    existing = cand
                    break

            # 3B. Multi-Signal Token Containment & Sequence Similarity
            if not existing:
                best_match = None
                highest_sim = 0.0

                for cand in all_candidates:
                    cand_price = float(cand.price_band_max or cand.price_band_min or 0.0)
                    is_matched, sim_score = compute_entity_similarity(
                        name1=raw_name,
                        name2=cand.name,
                        price1=incoming_price,
                        price2=cand_price,
                    )
                    if is_matched and sim_score > highest_sim:
                        highest_sim = sim_score
                        best_match = cand

                if best_match:
                    existing = best_match

            # Self-learning alias registration for future O(1) Tier 2 lookup
            if existing and norm_key:
                try:
                    stmt_check = select(IpoAlias).where(IpoAlias.normalized_alias == norm_key)
                    if not (await db.execute(stmt_check)).scalar_one_or_none():
                        new_alias = IpoAlias(
                            id=str(uuid.uuid4()),
                            ipo_id=existing.id,
                            alias=raw_name,
                            normalized_alias=norm_key,
                            source="ipowatch" if is_secondary else "groww" if is_groww else "ipoalerts",
                        )
                        db.add(new_alias)
                        await db.flush()
                except Exception:
                    pass

        def parse_date(val: Any) -> Optional[date]:
            if isinstance(val, date):
                return val
            if isinstance(val, str) and val:
                try:
                    return datetime.strptime(val[:10], "%Y-%m-%d").date()
                except Exception:
                    return None
            return None

        open_raw = ipo_dict.get("issue_open_date")
        close_raw = ipo_dict.get("issue_close_date")
        open_dt = parse_date(open_raw)
        close_dt = parse_date(close_raw)
        allot_dt = parse_date(ipo_dict.get("allotment_date"))
        refund_dt = parse_date(ipo_dict.get("refund_date"))
        listing_dt = parse_date(ipo_dict.get("listing_date"))

        # ── Compute Authentic IST Status via the Canonical Function ───
        if open_dt and close_dt:
            open_dt, close_dt = normalize_ipo_dates(open_dt, close_dt)
        computed_status = compute_ipo_status(open_dt, close_dt)

        # ── Merge and Enrich Existing Record ───────────────────────────
        if existing:
            # Preserve primary authentic official name if secondary feed has shorter name
            if not is_secondary:
                existing.name = raw_name
            if is_groww or not existing.type:
                existing.type = ipo_dict.get("type", existing.type)
            if is_groww and ipo_dict.get("isin"):
                existing.isin = ipo_dict["isin"]
            if is_groww and ipo_dict.get("logo_url") and not existing.logo_url:
                existing.logo_url = ipo_dict["logo_url"]

            existing.status = computed_status
            if open_dt is not None or not existing.issue_open_date:
                existing.issue_open_date = open_dt
            if close_dt is not None or not existing.issue_close_date:
                existing.issue_close_date = close_dt
            if ipo_dict.get("allotment_date"):
                existing.allotment_date = allot_dt
            if ipo_dict.get("listing_date"):
                existing.listing_date = listing_dt

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

            for field in ["subscription_retail", "subscription_shni", "subscription_bhni", "subscription_qib", "subscription_total"]:
                val = ipo_dict.get(field)
                if val is not None and float(val) > 0:
                    setattr(existing, field, float(val))

            if ipo_dict.get("gmp_percent") is not None and float(ipo_dict.get("gmp_percent")) > 0:
                existing.gmp_percent = float(ipo_dict.get("gmp_percent"))
                from app.utils.score_engine import IpoScoreEngine
                new_score, new_rec, _ = IpoScoreEngine.compute_score({
                    "gmp_percent": existing.gmp_percent,
                    "subscription_qib": existing.subscription_qib or 0.0,
                    "subscription_total": existing.subscription_total or 0.0,
                    "issue_size_cr": existing.issue_size_cr or 0.0,
                })
                existing.score = new_score
                existing.recommendation = new_rec
            elif ipo_dict.get("score") and not existing.score:
                existing.score = ipo_dict.get("score")
                existing.recommendation = ipo_dict.get("recommendation")

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
            status=computed_status,
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
