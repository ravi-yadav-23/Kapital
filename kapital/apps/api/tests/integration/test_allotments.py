import pytest
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.allotment import Allotment
from app.services.allotment_service import allotment_service
from app.schemas.allotment import StageSellRequest


@pytest.mark.asyncio
async def test_stage_sell_order_with_client_id(db_session: AsyncSession, seed_data):
    alt = Allotment(
        id="alt-test-1",
        account_id="acc-test-1",
        angel_client_id="R123456",
        ipo_id="ipo-test-1",
        account_name="Ravi Kumar",
        ipo_name="Techno NextGen Ltd",
        ipo_symbol="TECHNO",
        allotted_shares=65,
        issue_price=215.0,
        invested_amount=13975.0,
        status="ACTIVE",
        listing_date=date.today(),
        staged_sell_limit_price=310.0,
    )
    db_session.add(alt)
    await db_session.commit()

    req = StageSellRequest(
        limit_price=310.0,
        trigger_time="09:00:00",
    )
    result = await allotment_service.stage_sell_order(db_session, "alt-test-1", req)
    assert result["success"] is True
    assert "sell_order_id" in result["allotment"] or result["allotment"].staged_sell_limit_price == 310.0
