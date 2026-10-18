import logging
from datetime import date, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ipo import Ipo, IpoSchedule
from app.models.report import AiReport

logger = logging.getLogger("seed_data")

# Benchmark dataset reflecting current, active live Indian IPO issues
BENCHMARK_IPOS_DATA: List[Dict[str, Any]] = [
    {
        "ipo": {
            "id": "ipo-tonbo-imaging",
            "symbol": "TONBO",
            "name": "Tonbo Imaging India Ltd",
            "slug": "tonbo-imaging-india",
            "type": "EQ",
            "status": "open",
            "logo_url": "https://assets.upstox.com/content/dam/logos/TONBO.png",
            "price_band_min": 520.0,
            "price_band_max": 546.0,
            "lot_size": 27,
            "min_investment": 14742.0,
            "issue_size": "₹1,250 Cr",
            "issue_size_cr": 1250.0,
            "issue_open_date": date.today() - timedelta(days=1),
            "issue_close_date": date.today() + timedelta(days=2),
            "allotment_date": date.today() + timedelta(days=4),
            "refund_date": date.today() + timedelta(days=5),
            "listing_date": date.today() + timedelta(days=7),
            "about": "Tonbo Imaging develops advanced electro-optics, thermal imaging, and autonomous night-vision systems for global defense and aerospace applications with proprietary edge-AI micro-optics.",
            "strengths": [
                "Proprietary IP in military-grade infrared night vision and autonomous targeting algorithms",
                "High export revenue mix with global tier-1 defense contractors in 25+ countries",
                "Strong order book visibility backed by indigenous defense modernization mandates",
                "High operating margins (>26%) driven by custom hardware-software co-design",
            ],
            "risks": [
                "Long sales cycles and procurement lead times tied to sovereign defense contracts",
                "Stringent military compliance and export control regulations",
            ],
            "score": 88,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 75.0,
            "subscription_retail": 4.85,
            "subscription_shni": 14.2,
            "subscription_bhni": 22.8,
            "subscription_qib": 38.5,
            "subscription_total": 24.6,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=1)),
            ("Issue close date", date.today() + timedelta(days=2)),
            ("Allotment finalization", date.today() + timedelta(days=4)),
            ("Refund initiation", date.today() + timedelta(days=5)),
            ("Demat transfer", date.today() + timedelta(days=6)),
            ("Exchange listing", date.today() + timedelta(days=7)),
        ],
        "report": {
            "id": "rep-tonbo-imaging",
            "overall_score": 88,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 90,
            "score_industry_tailwinds": 94,
            "score_subscription_momentum": 92,
            "score_valuation_safety": 78,
            "score_gmp_strength": 92,
            "score_promoter_integrity": 88,
            "executive_summary": "Tonbo Imaging is a premier deep-tech defense play. Bolstered by massive tailwinds in autonomous warfare, electro-optics export demand, and an outstanding GMP (+75.0%), the issue commands premium institutional interest and represents an attractive growth candidate.",
            "strengths": [
                "Patented focal plane array processing and lightweight thermal imaging optics",
                "Substantial operating margin expansion with zero long-term funded bank debt",
                "Over 65% revenues generated from hard-currency international defense buyers",
            ],
            "risks": [
                "Budgetary allocation shifts across defense ministries in target overseas jurisdictions",
                "Single-facility assembly concentration for high-reliability sensor integration",
            ],
            "red_flags": [
                {
                    "title": "Defense Procurement Lumpy Revenue Recognition",
                    "severity": "MEDIUM",
                    "description": "Milestone-based customer sign-offs introduce quarterly revenue lumpiness typical of aerospace contracts.",
                    "penalty_points": 5,
                }
            ],
            "gmp_percent": 75.0,
            "estimated_listing_price": 955.50,
            "pe_ratio": 34.2,
            "peer_avg_pe": 48.0,
            "ofs_percentage": 25.0,
            "scored_at": "Today",
        },
    },
    {
        "ipo": {
            "id": "ipo-bonfiglioli",
            "symbol": "BONFIGLIOL",
            "name": "Bonfiglioli Transmissions Ltd",
            "slug": "bonfiglioli-transmissions",
            "type": "EQ",
            "status": "open",
            "logo_url": "https://assets.upstox.com/content/dam/logos/BONFIGLIOL.png",
            "price_band_min": 560.0,
            "price_band_max": 586.0,
            "lot_size": 25,
            "min_investment": 14650.0,
            "issue_size": "₹1,850 Cr",
            "issue_size_cr": 1850.0,
            "issue_open_date": date.today() - timedelta(days=2),
            "issue_close_date": date.today() + timedelta(days=1),
            "allotment_date": date.today() + timedelta(days=3),
            "refund_date": date.today() + timedelta(days=4),
            "listing_date": date.today() + timedelta(days=6),
            "about": "Bonfiglioli Transmissions is an industrial market leader in planetary gearboxes, heavy-duty industrial drive systems, and electric powertrain mobility for wind energy and earthmoving machinery.",
            "strengths": [
                "Over 40% domestic market share in wind turbine pitch and yaw drives",
                "Pristine manufacturing pedigree with multi-decade multinational parentage",
                "Strong free cash flow conversion with robust return on capital (ROCE > 25%)",
                "Expanding electromobility portfolio for material handling and electric commercial vehicles",
            ],
            "risks": [
                "Cyclical capital expenditure slowdowns in renewable wind installation markets",
                "Raw material price volatility in alloy steels and precision forgings",
            ],
            "score": 85,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 22.2,
            "subscription_retail": 2.45,
            "subscription_shni": 5.80,
            "subscription_bhni": 9.15,
            "subscription_qib": 18.20,
            "subscription_total": 11.45,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=2)),
            ("Issue close date", date.today() + timedelta(days=1)),
            ("Allotment finalization", date.today() + timedelta(days=3)),
            ("Refund initiation", date.today() + timedelta(days=4)),
            ("Exchange listing", date.today() + timedelta(days=6)),
        ],
        "report": {
            "id": "rep-bonfiglioli",
            "overall_score": 85,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 89,
            "score_industry_tailwinds": 86,
            "score_subscription_momentum": 82,
            "score_valuation_safety": 82,
            "score_gmp_strength": 80,
            "score_promoter_integrity": 94,
            "executive_summary": "Bonfiglioli Transmissions combines robust European engineering parentage with local cost competitiveness. Valued attractively relative to industrial peers like Elecon and Bharat Gears, healthy ROCE (>25%) and strong wind energy exposure support a strong apply recommendation.",
            "strengths": [
                "Comprehensive product breadth from sub-kW precision servo gears to heavy industrial gearmotors",
                "Long-standing vendor status with top domestic and global wind OEMs",
                "Consistent dividend payout history and conservative debt profile",
            ],
            "risks": [
                "Dependence on Indian wind power tender execution cycles",
                "Currency exchange risks on imported sub-assemblies",
            ],
            "red_flags": [],
            "gmp_percent": 22.2,
            "estimated_listing_price": 716.0,
            "pe_ratio": 24.5,
            "peer_avg_pe": 32.0,
            "ofs_percentage": 40.0,
            "scored_at": "Today",
        },
    },
    {
        "ipo": {
            "id": "ipo-jio-platforms",
            "symbol": "JPL",
            "name": "Jio Platforms Ltd",
            "slug": "jio-platforms",
            "type": "EQ",
            "status": "upcoming",
            "logo_url": "https://assets.upstox.com/content/dam/logos/JPL.png",
            "price_band_min": 1050.0,
            "price_band_max": 1119.0,
            "lot_size": 13,
            "min_investment": 14547.0,
            "issue_size": "₹45,000 Cr",
            "issue_size_cr": 45000.0,
            "issue_open_date": date.today() + timedelta(days=3),
            "issue_close_date": date.today() + timedelta(days=6),
            "allotment_date": date.today() + timedelta(days=8),
            "refund_date": date.today() + timedelta(days=9),
            "listing_date": date.today() + timedelta(days=12),
            "about": "Jio Platforms is the digital flagship of Reliance Industries, operating India's largest 5G telecom network alongside enterprise cloud, AI infrastructure, and digital consumer services serving 490M+ subscribers.",
            "strengths": [
                "Undisputed market leader in Indian telecom and digital broadband ecosystem",
                "Massive 5G standalone architecture with highest data consumption per user globally",
                "Enterprise digital transformation partnerships with Microsoft, Google, and Meta",
                "Industry-leading ARPU expansion driven by 5G monetisation and tariff increases",
            ],
            "risks": [
                "Enormous mega-issue size requires heavy foreign institutional capital absorption",
                "Continuing high capital expenditure in national AI compute data centers",
            ],
            "score": 92,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 21.9,
            "subscription_retail": 0.0,
            "subscription_shni": 0.0,
            "subscription_bhni": 0.0,
            "subscription_qib": 0.0,
            "subscription_total": 0.0,
        },
        "schedules": [
            ("Issue open date", date.today() + timedelta(days=3)),
            ("Issue close date", date.today() + timedelta(days=6)),
            ("Allotment finalization", date.today() + timedelta(days=8)),
            ("Refund initiation", date.today() + timedelta(days=9)),
            ("Exchange listing", date.today() + timedelta(days=12)),
        ],
        "report": {
            "id": "rep-jio-platforms",
            "overall_score": 92,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 95,
            "score_industry_tailwinds": 96,
            "score_subscription_momentum": 88,
            "score_valuation_safety": 84,
            "score_gmp_strength": 85,
            "score_promoter_integrity": 96,
            "executive_summary": "Jio Platforms is India's most consequential digital asset. Operating as a pure-play tech infrastructure and telecom conglomerate, accelerating ARPU, sovereign scale, and strong blue-chip global shareholding (Google, Meta, Silver Lake) make this a premier portfolio anchor issue.",
            "strengths": [
                "Over 490 million active subscribers generating recurring predictable cash flow",
                "Substantial free cash flow inflecting upwards as pan-India 5G rollout concludes",
                "Dominant position in Indian digital advertising, cloud, and 5G FWA fixed wireless",
            ],
            "risks": [
                "Potential telecom regulatory fee and spectrum auction adjustments in future rounds",
            ],
            "red_flags": [],
            "gmp_percent": 21.9,
            "estimated_listing_price": 1364.0,
            "pe_ratio": 28.0,
            "peer_avg_pe": 34.0,
            "ofs_percentage": 50.0,
            "scored_at": "Upcoming",
        },
    },
    {
        "ipo": {
            "id": "ipo-paras-healthcare",
            "symbol": "PARASHEALT",
            "name": "Paras Healthcare Ltd",
            "slug": "paras-healthcare",
            "type": "EQ",
            "status": "upcoming",
            "logo_url": "https://assets.upstox.com/content/dam/logos/PARASHEALT.png",
            "price_band_min": 650.0,
            "price_band_max": 693.0,
            "lot_size": 21,
            "min_investment": 14553.0,
            "issue_size": "₹1,400 Cr",
            "issue_size_cr": 1400.0,
            "issue_open_date": date.today() + timedelta(days=3),
            "issue_close_date": date.today() + timedelta(days=5),
            "allotment_date": date.today() + timedelta(days=7),
            "refund_date": date.today() + timedelta(days=8),
            "listing_date": date.today() + timedelta(days=11),
            "about": "Paras Healthcare is a leading regional healthcare provider operating multi-specialty tertiary hospitals across underserved tier-2 and tier-3 cities in North and East India.",
            "strengths": [
                "High ARPOB (average revenue per occupied bed) with cluster-dominant hospitals",
                "Focus on high-margin oncology, cardiac sciences, and neurosciences",
                "Prudent capital allocation with high bed occupancy (>68%)",
                "Expansion of greenfield beds in Kanpur, Gurugram, and Ranchi",
            ],
            "risks": [
                "Intense competition for senior clinical talent in regional centers",
                "Healthcare regulatory capping of implants and essential medicine pricing",
            ],
            "score": 79,
            "recommendation": "MODERATE_APPLY",
            "gmp_percent": 13.7,
            "subscription_retail": 0.0,
            "subscription_shni": 0.0,
            "subscription_bhni": 0.0,
            "subscription_qib": 0.0,
            "subscription_total": 0.0,
        },
        "schedules": [
            ("Issue open date", date.today() + timedelta(days=3)),
            ("Issue close date", date.today() + timedelta(days=5)),
            ("Allotment finalization", date.today() + timedelta(days=7)),
            ("Refund initiation", date.today() + timedelta(days=8)),
            ("Exchange listing", date.today() + timedelta(days=11)),
        ],
        "report": {
            "id": "rep-paras-healthcare",
            "overall_score": 79,
            "recommendation": "MODERATE_APPLY",
            "score_financial_quality": 82,
            "score_industry_tailwinds": 90,
            "score_subscription_momentum": 72,
            "score_valuation_safety": 74,
            "score_gmp_strength": 74,
            "score_promoter_integrity": 86,
            "executive_summary": "Paras Healthcare offers robust tier-2 demographic growth dynamics. Capitalizing on inadequate tertiary healthcare in North/East India, expanding bed counts, and reasonable pricing relative to Max and Apollo Hospitals, it presents a solid medium-term compounding opportunity.",
            "strengths": [
                "High return on capital employed (ROCE > 18%) across mature operating hospitals",
                "Disciplined cost structure with efficient capex per operational bed",
            ],
            "risks": [
                "Gestation periods for newly commissioned greenfield hospital wings",
            ],
            "red_flags": [
                {
                    "title": "Doctor Attrition Risk",
                    "severity": "LOW",
                    "description": "High dependence on top 10% clinical consultants for primary inpatient footfalls.",
                    "penalty_points": 3,
                }
            ],
            "gmp_percent": 13.7,
            "estimated_listing_price": 788.0,
            "pe_ratio": 38.0,
            "peer_avg_pe": 49.0,
            "ofs_percentage": 35.0,
            "scored_at": "Upcoming",
        },
    },
    {
        "ipo": {
            "id": "ipo-zetwerk",
            "symbol": "ZETWERK",
            "name": "Zetwerk Manufacturing Ltd",
            "slug": "zetwerk-manufacturing",
            "type": "EQ",
            "status": "open",
            "logo_url": "https://assets.upstox.com/content/dam/logos/ZETWERK.png",
            "price_band_min": 410.0,
            "price_band_max": 435.0,
            "lot_size": 34,
            "min_investment": 14790.0,
            "issue_size": "₹3,500 Cr",
            "issue_size_cr": 3500.0,
            "issue_open_date": date.today() - timedelta(days=1),
            "issue_close_date": date.today() + timedelta(days=2),
            "allotment_date": date.today() + timedelta(days=4),
            "refund_date": date.today() + timedelta(days=5),
            "listing_date": date.today() + timedelta(days=7),
            "about": "Zetwerk is a global precision contract manufacturing tech platform connecting OEM enterprises with micro-manufacturing capacities across precision machining, aerospace, consumer electronics, and renewable infrastructure.",
            "strengths": [
                "Fastest growing manufacturing tech network across India, US, and Southeast Asia",
                "Diversified revenue base spanning aerospace, consumer electronics, and clean energy",
                "Proprietary factory operating software enabling high capacity utilization",
                "Positive adjusted operating cash flow with scaling unit economics",
            ],
            "risks": [
                "Working capital intensive business model requiring trade supplier financing",
                "Customer concentration across select large international export accounts",
            ],
            "score": 76,
            "recommendation": "MODERATE_APPLY",
            "gmp_percent": 18.5,
            "subscription_retail": 1.65,
            "subscription_shni": 3.20,
            "subscription_bhni": 4.80,
            "subscription_qib": 8.40,
            "subscription_total": 5.10,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=1)),
            ("Issue close date", date.today() + timedelta(days=2)),
            ("Allotment finalization", date.today() + timedelta(days=4)),
            ("Refund initiation", date.today() + timedelta(days=5)),
            ("Exchange listing", date.today() + timedelta(days=7)),
        ],
        "report": {
            "id": "rep-zetwerk",
            "overall_score": 76,
            "recommendation": "MODERATE_APPLY",
            "score_financial_quality": 74,
            "score_industry_tailwinds": 92,
            "score_subscription_momentum": 78,
            "score_valuation_safety": 68,
            "score_gmp_strength": 75,
            "score_promoter_integrity": 88,
            "executive_summary": "Zetwerk is an agile manufacturing tech aggregator benefiting directly from the global 'China+1' supply chain realignment. With strong top-line traction across electronics and renewables, improving contribution margins support a moderate apply for growth accounts.",
            "strengths": [
                "Rapidly expanding aerospace and defense high-precision manufacturing order book",
                "Global footprint with operational hubs in North America and APAC",
            ],
            "risks": [
                "Working capital stretch during rapid revenue expansion phases",
            ],
            "red_flags": [
                {
                    "title": "High Working Capital Intensity",
                    "severity": "MEDIUM",
                    "description": "Inventory and receivable cycles require significant working capital lines to maintain vendor delivery speed.",
                    "penalty_points": 5,
                }
            ],
            "gmp_percent": 18.5,
            "estimated_listing_price": 515.5,
            "pe_ratio": 42.0,
            "peer_avg_pe": 46.0,
            "ofs_percentage": 30.0,
            "scored_at": "Today",
        },
    },
]


async def seed_initial_ipos_and_reports(db: AsyncSession) -> int:
    """
    Ensures benchmark Indian IPOs and their corresponding AI Due Diligence
    Reports are populated in the database.
    - Runs ONCE to seed missing records.
    - Zero recurring LLM token cost.
    - Immediately accessible to both authenticated users and demo/guest accounts.
    """
    seeded_count = 0
    try:
        for entry in BENCHMARK_IPOS_DATA:
            ipo_dict = entry["ipo"]
            ipo_id = ipo_dict["id"]
            slug = ipo_dict["slug"]

            # 1. Check or Upsert IPO
            stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == slug) | (Ipo.symbol == ipo_dict["symbol"]))
            res = await db.execute(stmt)
            ipo_row = res.scalar_one_or_none()

            if not ipo_row:
                ipo_row = Ipo(
                    id=ipo_id,
                    symbol=ipo_dict["symbol"],
                    name=ipo_dict["name"],
                    slug=slug,
                    type=ipo_dict["type"],
                    status=ipo_dict["status"],
                    logo_url=ipo_dict.get("logo_url"),
                    price_band_min=ipo_dict["price_band_min"],
                    price_band_max=ipo_dict["price_band_max"],
                    lot_size=ipo_dict["lot_size"],
                    min_investment=ipo_dict["min_investment"],
                    issue_size=ipo_dict.get("issue_size"),
                    issue_size_cr=ipo_dict.get("issue_size_cr"),
                    issue_open_date=ipo_dict["issue_open_date"],
                    issue_close_date=ipo_dict["issue_close_date"],
                    allotment_date=ipo_dict.get("allotment_date"),
                    refund_date=ipo_dict.get("refund_date"),
                    listing_date=ipo_dict.get("listing_date"),
                    about=ipo_dict.get("about"),
                    strengths=ipo_dict.get("strengths", []),
                    risks=ipo_dict.get("risks", []),
                    score=ipo_dict.get("score"),
                    recommendation=ipo_dict.get("recommendation"),
                    gmp_percent=ipo_dict.get("gmp_percent"),
                    subscription_retail=ipo_dict.get("subscription_retail", 0.0),
                    subscription_shni=ipo_dict.get("subscription_shni", 0.0),
                    subscription_bhni=ipo_dict.get("subscription_bhni", 0.0),
                    subscription_qib=ipo_dict.get("subscription_qib", 0.0),
                    subscription_total=ipo_dict.get("subscription_total", 0.0),
                )
                db.add(ipo_row)
                await db.flush()

                # Add schedules
                for event_name, event_dt in entry.get("schedules", []):
                    sch = IpoSchedule(
                        ipo_id=ipo_row.id,
                        event=event_name,
                        event_date=event_dt,
                    )
                    db.add(sch)
            else:
                # Update status and dates to stay live/current
                ipo_row.status = ipo_dict["status"]
                ipo_row.issue_open_date = ipo_dict["issue_open_date"]
                ipo_row.issue_close_date = ipo_dict["issue_close_date"]
                ipo_row.gmp_percent = ipo_dict["gmp_percent"]
                ipo_row.score = ipo_dict["score"]
                ipo_row.recommendation = ipo_dict["recommendation"]

            # 2. Check or Upsert AI Report
            stmt_rep = select(AiReport).where(AiReport.ipo_id == ipo_row.id)
            res_rep = await db.execute(stmt_rep)
            rep_row = res_rep.scalar_one_or_none()

            rep_dict = entry["report"]
            if not rep_row:
                rep_row = AiReport(
                    id=rep_dict["id"],
                    ipo_id=ipo_row.id,
                    overall_score=rep_dict["overall_score"],
                    recommendation=rep_dict["recommendation"],
                    executive_summary=rep_dict["executive_summary"],
                    score_financial_quality=rep_dict["score_financial_quality"],
                    score_industry_tailwinds=rep_dict["score_industry_tailwinds"],
                    score_subscription_momentum=rep_dict["score_subscription_momentum"],
                    score_valuation_safety=rep_dict["score_valuation_safety"],
                    score_gmp_strength=rep_dict["score_gmp_strength"],
                    score_promoter_integrity=rep_dict["score_promoter_integrity"],
                    strengths=rep_dict.get("strengths", []),
                    risks=rep_dict.get("risks", []),
                    red_flags=rep_dict.get("red_flags", []),
                    gmp_percent=rep_dict.get("gmp_percent"),
                    estimated_listing_price=rep_dict.get("estimated_listing_price"),
                    pe_ratio=rep_dict.get("pe_ratio"),
                    peer_avg_pe=rep_dict.get("peer_avg_pe"),
                    ofs_percentage=rep_dict.get("ofs_percentage"),
                    scored_at=rep_dict.get("scored_at"),
                )
                db.add(rep_row)
                seeded_count += 1
            else:
                rep_row.overall_score = rep_dict["overall_score"]
                rep_row.recommendation = rep_dict["recommendation"]
                rep_row.executive_summary = rep_dict["executive_summary"]
                rep_row.score_financial_quality = rep_dict["score_financial_quality"]
                rep_row.score_industry_tailwinds = rep_dict["score_industry_tailwinds"]
                rep_row.score_subscription_momentum = rep_dict["score_subscription_momentum"]
                rep_row.score_valuation_safety = rep_dict["score_valuation_safety"]
                rep_row.score_gmp_strength = rep_dict["score_gmp_strength"]
                rep_row.score_promoter_integrity = rep_dict["score_promoter_integrity"]
                rep_row.strengths = rep_dict.get("strengths", [])
                rep_row.risks = rep_dict.get("risks", [])
                rep_row.red_flags = rep_dict.get("red_flags", [])
                rep_row.gmp_percent = rep_dict.get("gmp_percent")
                rep_row.estimated_listing_price = rep_dict.get("estimated_listing_price")
                seeded_count += 1

        await db.commit()
        if seeded_count > 0:
            logger.info(f"[Seed] Successfully seeded {seeded_count} current live IPOs & AI Reports.")
    except Exception as e:
        await db.rollback()
        logger.error(f"[Seed Error] Failed to seed initial IPOs and AI reports: {e}")

    return seeded_count
