import asyncio
import pytest
import pytest_asyncio
from datetime import date, timedelta
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport

from app.models.base import Base
from app.db.database import get_db
from app.main import app
from app.models.account import FamilyAccount
from app.models.ipo import Ipo
from app.models.report import AiReport

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def override_get_db(test_engine):
    """Override FastAPI get_db dependency to point to SQLite in-memory."""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

    async def _get_test_db():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(scope="session")
async def seed_data(test_engine):
    """Seeds baseline account and IPO data for deterministic route tests."""
    from app.services.angel_service import angel_service
    angel_service._instrument_cache["NSE:TECHNO"] = "3045"
    angel_service._instrument_cache_loaded = True

    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as db_session:
        existing_acc = await db_session.get(FamilyAccount, "acc-test-1")
        if not existing_acc:
            acc = FamilyAccount(
                id="acc-test-1",
                name="Ravi Kumar",
                relation="Self",
                angel_client_id="R123456",
                total_demat_balance=1500000.0,
                available_liquid_balance=1200000.0,
                locked_asba_balance=300000.0,
                total_bids_placed=5,
                total_allotments_won=2,
                total_realized_pnl=45000.0,
                default_category_preference="bHNI",
                is_active=True,
            )
            ipo = Ipo(
                id="ipo-test-1",
                symbol="TECHNO",
                name="Techno NextGen Ltd",
                slug="techno-nextgen",
                type="EQ",
                status="open",
                price_band_min=200.0,
                price_band_max=215.0,
                lot_size=65,
                min_investment=13975.0,
                issue_size_cr=1200.0,
                issue_open_date=date.today(),
                issue_close_date=date.today() + timedelta(days=2),
                listing_date=date.today() + timedelta(days=5),
                gmp_percent=45.0,
                score=82,
                recommendation="STRONG_APPLY",
                subscription_retail=3.5,
                subscription_shni=8.2,
                subscription_bhni=12.4,
                subscription_qib=18.6,
                subscription_total=14.2,
            )
            report = AiReport(
                id="rep-test-1",
                ipo_id="ipo-test-1",
                overall_score=82,
                recommendation="STRONG_APPLY",
                executive_summary="High quality growth profile with massive institutional backing.",
                score_financial_quality=85,
                score_industry_tailwinds=80,
                score_subscription_momentum=90,
                score_valuation_safety=75,
                score_gmp_strength=90,
                score_promoter_integrity=85,
                strengths=["Robust ROE of 24%", "Debt-free balance sheet"],
                risks=["Key customer concentration"],
                red_flags=[],
                gmp_percent=45.0,
                estimated_listing_price=311.75,
                scored_at="12 Sep 2026",
            )
            db_session.add_all([acc, ipo, report])
            await db_session.commit()
            return {"account": acc, "ipo": ipo, "report": report}
        return {}
