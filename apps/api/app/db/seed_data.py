import logging
from datetime import date, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.ipo import Ipo, IpoSchedule
from app.models.report import AiReport

logger = logging.getLogger("seed_data")

BENCHMARK_IPOS_DATA: List[Dict[str, Any]] = [
    {
        "ipo": {
            "id": "ipo-hyundai-motor",
            "symbol": "HYUNDAI",
            "name": "Hyundai Motor India Ltd",
            "slug": "hyundai-motor-india",
            "type": "EQ",
            "status": "open",
            "logo_url": "https://assets.upstox.com/content/dam/logos/HYUNDAI.png",
            "price_band_min": 1865.0,
            "price_band_max": 1960.0,
            "lot_size": 7,
            "min_investment": 13720.0,
            "issue_size": "₹27,870 Cr",
            "issue_size_cr": 27870.0,
            "issue_open_date": date.today() - timedelta(days=1),
            "issue_close_date": date.today() + timedelta(days=2),
            "allotment_date": date.today() + timedelta(days=4),
            "refund_date": date.today() + timedelta(days=5),
            "listing_date": date.today() + timedelta(days=7),
            "about": "Hyundai Motor India is the second largest passenger vehicle OEM in India with ~14.6% market share, producing segment-leading SUVs including Creta, Venue, and Exter.",
            "strengths": [
                "Dominant 60%+ contribution from high-margin SUV portfolio",
                "Strong return on equity (ROE > 28%) and robust free cash flow",
                "Direct technological parentage from Hyundai Motor Company (HMC South Korea)",
                "Expanding EV localization via Talegaon plant acquisition",
            ],
            "risks": [
                "100% Offer for Sale (OFS) with zero fresh capital into India ops",
                "Elevated 3.5% royalty payout to Korean parent entity",
                "Increasing competition from Mahindra & Mahindra and Tata Motors in EV space",
            ],
            "score": 86,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 14.5,
            "subscription_retail": 1.85,
            "subscription_shni": 3.42,
            "subscription_bhni": 4.18,
            "subscription_qib": 6.95,
            "subscription_total": 4.82,
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
            "id": "rep-hyundai-motor",
            "overall_score": 86,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 92,
            "score_industry_tailwinds": 88,
            "score_subscription_momentum": 84,
            "score_valuation_safety": 78,
            "score_gmp_strength": 75,
            "score_promoter_integrity": 95,
            "executive_summary": "Hyundai Motor India represents a blue-chip Indian automotive titan. While valued at ~26x FY24 P/E (fair relative to Maruti's ~29x), its SUV-driven premiumization and robust return metrics (ROE > 28%) make it an institutional-grade long-term compounder despite 100% OFS structure.",
            "strengths": [
                "Highest EBITDA margin per vehicle amongst Indian mass-market OEMs (~13.1%)",
                "Unmatched brand equity in premium compact and mid-size SUV segments",
                "Zero net debt balance sheet with consistent operating cash flows",
            ],
            "risks": [
                "100% OFS of ₹27,870 Cr leaves no growth capital directly in company",
                "3.5% brand and technology royalty outflows to South Korean parent entity",
            ],
            "red_flags": [
                {
                    "title": "Pure Secondary Offer For Sale (OFS)",
                    "severity": "MEDIUM",
                    "description": "Entire ₹27,870 Cr issue proceeds go to promoter entity Hyundai Motor Company; zero fresh capital invested in domestic manufacturing capacity.",
                    "penalty_points": 5,
                },
                {
                    "title": "Parent Royalty Agreement Escalation",
                    "severity": "LOW",
                    "description": "Royalty payments set at 3.5% of net revenues could face regulatory scrutiny if vehicle margin expansion softens.",
                    "penalty_points": 3,
                },
            ],
            "gmp_percent": 14.5,
            "estimated_listing_price": 2244.20,
            "pe_ratio": 26.2,
            "peer_avg_pe": 29.4,
            "ofs_percentage": 100.0,
            "scored_at": "Today",
        },
    },
    {
        "ipo": {
            "id": "ipo-waaree-energies",
            "symbol": "WAAREE",
            "name": "Waaree Energies Ltd",
            "slug": "waaree-energies",
            "type": "EQ",
            "status": "closing_today",
            "logo_url": "https://assets.upstox.com/content/dam/logos/WAAREE.png",
            "price_band_min": 1427.0,
            "price_band_max": 1503.0,
            "lot_size": 9,
            "min_investment": 13527.0,
            "issue_size": "₹4,321 Cr",
            "issue_size_cr": 4321.0,
            "issue_open_date": date.today() - timedelta(days=2),
            "issue_close_date": date.today(),
            "allotment_date": date.today() + timedelta(days=2),
            "refund_date": date.today() + timedelta(days=3),
            "listing_date": date.today() + timedelta(days=5),
            "about": "Waaree Energies is India's largest manufacturer of solar PV modules with an aggregate installed capacity of 12 GW and extensive international export distribution to the United States.",
            "strengths": [
                "Market leader in Indian solar PV manufacturing with 21%+ domestic market share",
                "Massive order book exceeding ₹20,000+ Cr across utility and export customers",
                "US IRA export tailwinds driving stellar margin expansion in FY24/25",
                "Backward integration into solar cell manufacturing (6 GW facility in Odisha)",
            ],
            "risks": [
                "Geopolitical dependency on US tariffs and anti-dumping circumvention rulings",
                "Raw material dependency on imported polysilicon and solar wafers from China",
            ],
            "score": 94,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 98.5,
            "subscription_retail": 10.8,
            "subscription_shni": 48.5,
            "subscription_bhni": 74.2,
            "subscription_qib": 112.4,
            "subscription_total": 76.3,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=2)),
            ("Issue close date", date.today()),
            ("Allotment finalization", date.today() + timedelta(days=2)),
            ("Refund initiation", date.today() + timedelta(days=3)),
            ("Exchange listing", date.today() + timedelta(days=5)),
        ],
        "report": {
            "id": "rep-waaree-energies",
            "overall_score": 94,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 95,
            "score_industry_tailwinds": 98,
            "score_subscription_momentum": 98,
            "score_valuation_safety": 84,
            "score_gmp_strength": 98,
            "score_promoter_integrity": 90,
            "executive_summary": "Waaree Energies is a category-defining solar play with hyper-growth revenue (+70% CAGR over 3 years) and an astronomical GMP (+98.5%). With massive order visibility of ₹20,000 Cr+ and high QIB institutional demand, it is rated a top conviction strong apply for both listing pop and multi-year decarbonization thematic holding.",
            "strengths": [
                "Largest solar module manufacturer in India (12 GW operational, expanding to 20 GW)",
                "Export revenue share > 65% benefiting directly from US clean energy incentives",
                "Staggering profit jump: Net profit surged >150% in FY24",
            ],
            "risks": [
                "Regulatory vulnerability to US trade tariffs on overseas solar imports",
                "Fluctuations in global polysilicon pricing",
            ],
            "red_flags": [
                {
                    "title": "US Export Concentration Risk",
                    "severity": "MEDIUM",
                    "description": "Over 60% of module export revenue is derived from US buyers; changes in US customs enforcement (UFLPA) pose potential shipment delays.",
                    "penalty_points": 5,
                }
            ],
            "gmp_percent": 98.5,
            "estimated_listing_price": 2983.45,
            "pe_ratio": 28.5,
            "peer_avg_pe": 45.2,
            "ofs_percentage": 18.2,
            "scored_at": "Today",
        },
    },
    {
        "ipo": {
            "id": "ipo-swiggy-ltd",
            "symbol": "SWIGGY",
            "name": "Swiggy Ltd",
            "slug": "swiggy-ltd",
            "type": "EQ",
            "status": "open",
            "logo_url": "https://assets.upstox.com/content/dam/logos/SWIGGY.png",
            "price_band_min": 371.0,
            "price_band_max": 390.0,
            "lot_size": 38,
            "min_investment": 14820.0,
            "issue_size": "₹11,327 Cr",
            "issue_size_cr": 11327.0,
            "issue_open_date": date.today() - timedelta(days=1),
            "issue_close_date": date.today() + timedelta(days=2),
            "allotment_date": date.today() + timedelta(days=4),
            "refund_date": date.today() + timedelta(days=5),
            "listing_date": date.today() + timedelta(days=7),
            "about": "Swiggy is a pioneering consumer-tech platform operating India's prominent on-demand food delivery network and Instamart quick-commerce marketplace across 680+ cities.",
            "strengths": [
                "Duopoly market structure with Zomato across Indian food delivery and grocery",
                "Instamart rapid expansion with dark store network exceeding 600+ locations",
                "Food delivery segment achieved adjusted EBITDA break-even",
                "Substantial fresh issue component (₹4,499 Cr) providing growth runway",
            ],
            "risks": [
                "Consolidated entity remains net loss-making due to quick commerce investments",
                "Fierce competitive war against Blinkit (Zomato) and Zepto in 10-minute delivery",
                "High churn and delivery fleet partner payout inflation",
            ],
            "score": 73,
            "recommendation": "MODERATE_APPLY",
            "gmp_percent": 7.5,
            "subscription_retail": 1.15,
            "subscription_shni": 1.48,
            "subscription_bhni": 2.20,
            "subscription_qib": 4.12,
            "subscription_total": 2.85,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=1)),
            ("Issue close date", date.today() + timedelta(days=2)),
            ("Allotment finalization", date.today() + timedelta(days=4)),
            ("Refund initiation", date.today() + timedelta(days=5)),
            ("Exchange listing", date.today() + timedelta(days=7)),
        ],
        "report": {
            "id": "rep-swiggy-ltd",
            "overall_score": 73,
            "recommendation": "MODERATE_APPLY",
            "score_financial_quality": 64,
            "score_industry_tailwinds": 94,
            "score_subscription_momentum": 72,
            "score_valuation_safety": 65,
            "score_gmp_strength": 65,
            "score_promoter_integrity": 86,
            "executive_summary": "Swiggy offers exposure to India's burgeoning quick-commerce and consumer internet secular growth. While food delivery is comfortably profitable, aggressive cash burn in Instamart dark stores keeps bottom-line net losses elevated. Priced at ~6.8x EV/Sales (modest discount to Zomato's 9.5x), it offers tactical upside for aggressive growth portfolios.",
            "strengths": [
                "High customer retention and increasing GOV per active transacting user",
                "Large war chest post-IPO to fortify dark store footprint against Zepto/Blinkit",
                "Dineout and Out-of-home verticals showing strong unit economics",
            ],
            "risks": [
                "Consolidated net loss of ₹2,350 Cr in FY24",
                "Intense battle for dark store real estate in Tier-1 metros compressing margins",
            ],
            "red_flags": [
                {
                    "title": "Persistent Consolidated Net Losses",
                    "severity": "HIGH",
                    "description": "Company reported negative bottom-line profitability in FY22, FY23, and FY24; pathway to consolidated net profit relies on quick commerce rationalization.",
                    "penalty_points": 10,
                },
                {
                    "title": "Gig Workforce Social Security Exposure",
                    "severity": "LOW",
                    "description": "State-level gig worker welfare bills could introduce mandatory cess per order, increasing unit delivery costs.",
                    "penalty_points": 3,
                },
            ],
            "gmp_percent": 7.5,
            "estimated_listing_price": 419.25,
            "pe_ratio": None,
            "peer_avg_pe": None,
            "ofs_percentage": 60.3,
            "scored_at": "Today",
        },
    },
    {
        "ipo": {
            "id": "ipo-bajaj-housing-finance",
            "symbol": "BAJAJHSG",
            "name": "Bajaj Housing Finance Ltd",
            "slug": "bajaj-housing-finance",
            "type": "EQ",
            "status": "closed",
            "logo_url": "https://assets.upstox.com/content/dam/logos/BAJAJHSG.png",
            "price_band_min": 66.0,
            "price_band_max": 70.0,
            "lot_size": 214,
            "min_investment": 14980.0,
            "issue_size": "₹6,560 Cr",
            "issue_size_cr": 6560.0,
            "issue_open_date": date.today() - timedelta(days=30),
            "issue_close_date": date.today() - timedelta(days=27),
            "allotment_date": date.today() - timedelta(days=25),
            "refund_date": date.today() - timedelta(days=24),
            "listing_date": date.today() - timedelta(days=22),
            "about": "Bajaj Housing Finance is India's second-largest non-deposit-taking housing finance company, propelled by the premier Bajaj Finserv/Finance brand pedigree and industry-lowest GNPA ratios.",
            "strengths": [
                "Lowest GNPA (0.28%) and NNPA (0.11%) in the entire Indian HFC ecosystem",
                "Unmatched credit rating (CRISIL AAA / Stable) ensuring rock-bottom borrowing costs",
                "AUM scaled to ₹97,000+ Cr with consistent 30%+ CAGR",
                "Strong parentage with immense cross-sell synergies across 88M+ Bajaj Finance customers",
            ],
            "risks": [
                "Competitive margin compression from top private and PSU banks in prime home loans",
                "High reliance on wholesale and capital market bank borrowings",
            ],
            "score": 93,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 114.2,
            "subscription_retail": 7.4,
            "subscription_shni": 43.2,
            "subscription_bhni": 68.5,
            "subscription_qib": 222.1,
            "subscription_total": 67.4,
        },
        "schedules": [
            ("Issue open date", date.today() - timedelta(days=30)),
            ("Issue close date", date.today() - timedelta(days=27)),
            ("Allotment finalization", date.today() - timedelta(days=25)),
            ("Exchange listing", date.today() - timedelta(days=22)),
        ],
        "report": {
            "id": "rep-bajaj-housing-finance",
            "overall_score": 93,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 96,
            "score_industry_tailwinds": 90,
            "score_subscription_momentum": 98,
            "score_valuation_safety": 85,
            "score_gmp_strength": 98,
            "score_promoter_integrity": 96,
            "executive_summary": "Bajaj Housing Finance demonstrated the highest quality institutional issue of the year. Backed by the Sanjiv Bajaj group, pristine asset quality (GNPA < 0.3%), and AAA funding advantages, it offered multi-bagger listing gain potential (+114% GMP) and exemplary multi-year safety.",
            "strengths": [
                "Benchmark asset quality with industry-leading underwriting algorithms",
                "Access to Bajaj Finance's massive proprietary pre-approved customer database",
                "Net interest margin resilience and operating leverage efficiency",
            ],
            "risks": [
                "Prepayment risk in prime home loans if interest rates drop aggressively",
            ],
            "red_flags": [],
            "gmp_percent": 114.2,
            "estimated_listing_price": 150.0,
            "pe_ratio": 29.8,
            "peer_avg_pe": 32.5,
            "ofs_percentage": 50.0,
            "scored_at": "September 2026",
        },
    },
    {
        "ipo": {
            "id": "ipo-ntpc-green-energy",
            "symbol": "NTPCGREEN",
            "name": "NTPC Green Energy Ltd",
            "slug": "ntpc-green-energy",
            "type": "EQ",
            "status": "upcoming",
            "logo_url": "https://assets.upstox.com/content/dam/logos/NTPCGREEN.png",
            "price_band_min": 102.0,
            "price_band_max": 108.0,
            "lot_size": 138,
            "min_investment": 14904.0,
            "issue_size": "₹10,000 Cr",
            "issue_size_cr": 10000.0,
            "issue_open_date": date.today() + timedelta(days=3),
            "issue_close_date": date.today() + timedelta(days=6),
            "allotment_date": date.today() + timedelta(days=8),
            "refund_date": date.today() + timedelta(days=9),
            "listing_date": date.today() + timedelta(days=12),
            "about": "NTPC Green Energy is the umbrella renewable energy vehicle of Maharatna PSU NTPC Limited, dedicated to building 60 GW of renewable solar, wind, and green hydrogen capacity by 2032.",
            "strengths": [
                "Sovereign Maharatna backing with lowest cost of capital in power sector",
                "3.5 GW operational portfolio with 11+ GW in contracted development pipeline",
                "100% fresh issue of ₹10,000 Cr directly de-leveraging debt and funding expansion",
                "Long-term 25-year PPAs secured with creditworthy state and central off-takers",
            ],
            "risks": [
                "Capital expenditure execution risk on massive 60 GW long-term targets",
                "Off-taker payment delay risks from select state discoms",
            ],
            "score": 83,
            "recommendation": "STRONG_APPLY",
            "gmp_percent": 18.0,
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
            "id": "rep-ntpc-green-energy",
            "overall_score": 83,
            "recommendation": "STRONG_APPLY",
            "score_financial_quality": 82,
            "score_industry_tailwinds": 94,
            "score_subscription_momentum": 78,
            "score_valuation_safety": 80,
            "score_gmp_strength": 78,
            "score_promoter_integrity": 95,
            "executive_summary": "NTPC Green Energy represents a cornerstone sovereign green transition asset. Benefiting from 100% fresh issue proceeds (₹10,000 Cr) dedicated to debt repayment and capex, alongside parent NTPC's stellar AAA balance sheet and long-term 25-year PPAs, it offers defensiveness and scale.",
            "strengths": [
                "Zero OFS component — 100% of proceeds strengthen balance sheet",
                "Secured long-term tariff visibility with SECI and sovereign utilities",
                "Scale advantages in renewable turbine and solar module procurement",
            ],
            "risks": [
                "Grid curtailment and evacuation infrastructure bottlenecks in western hubs",
            ],
            "red_flags": [
                {
                    "title": "Discom Receivable Days Risk",
                    "severity": "LOW",
                    "description": "Counterparty risk from state distribution companies; mitigated by central payment security tripartite mechanism.",
                    "penalty_points": 3,
                }
            ],
            "gmp_percent": 18.0,
            "estimated_listing_price": 127.44,
            "pe_ratio": 52.0,
            "peer_avg_pe": 58.0,
            "ofs_percentage": 0.0,
            "scored_at": "Upcoming",
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
            stmt = select(Ipo).where((Ipo.id == ipo_id) | (Ipo.slug == slug))
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
                # Ensure fields are up-to-date
                if not rep_row.executive_summary or rep_row.overall_score == 0:
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
            logger.info(f"[Seed] Successfully seeded {seeded_count} benchmark IPOs & AI Reports.")
    except Exception as e:
        await db.rollback()
        logger.error(f"[Seed Error] Failed to seed initial IPOs and AI reports: {e}")

    return seeded_count
