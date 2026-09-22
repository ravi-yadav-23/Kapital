import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.fund_service import fund_service
from app.models.account import FamilyAccount


@pytest.mark.asyncio
async def test_fund_summary_calculation(db_session: AsyncSession):
    # Add two test accounts
    a1 = FamilyAccount(
        id="f-acc-1",
        name="Papa",
        relation="Father",
        angel_client_id="P123456",
        total_demat_balance=500000.0,
        available_liquid_balance=400000.0,
        locked_asba_balance=100000.0,
        is_active=True,
    )
    a2 = FamilyAccount(
        id="f-acc-2",
        name="Mummy",
        relation="Mother",
        angel_client_id="M123456",
        total_demat_balance=300000.0,
        available_liquid_balance=250000.0,
        locked_asba_balance=50000.0,
        is_active=True,
    )
    db_session.add(a1)
    db_session.add(a2)
    await db_session.commit()

    summary = await fund_service.get_fund_summary(db_session)
    assert summary.total_family_balance >= 800000.0
    assert summary.total_available >= 650000.0
    assert summary.total_locked_asba >= 150000.0
    assert summary.utilization_percent > 0
