import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.order_service import order_service
from app.schemas.order import OrderCreate
from app.models.allotment import AsbaLock
from app.models.account import FamilyAccount


@pytest.mark.asyncio
async def test_order_creation_and_asba_lock(db_session: AsyncSession, seed_data):
    req = OrderCreate(
        account_id="acc-test-1",
        ipo_id="ipo-test-1",
        category="RETAIL",
        lots=1,
        bid_price=215.0,
        upi_vpa="testuser@okhdfcbank",
    )

    # 1. Place order
    order_res = await order_service.create_order(db_session, req)
    assert order_res.status in ["CONFIRMED", "PENDING"]

    # 2. Verify ASBA lock record created in database
    stmt = select(AsbaLock).where(
        (AsbaLock.account_id == "acc-test-1") & (AsbaLock.ipo_id == "ipo-test-1")
    )
    res = await db_session.execute(stmt)
    lock = res.scalar_one_or_none()
    assert lock is not None
    assert lock.amount > 0

    # 3. Cancel order and verify ASBA lock is released
    await order_service.cancel_order(db_session, order_res.id)
    db_session.expire_all()
    fresh_stmt = select(AsbaLock).where(
        (AsbaLock.account_id == "acc-test-1") & (AsbaLock.ipo_id == "ipo-test-1")
    )
    res_after = await db_session.execute(fresh_stmt)
    lock_after = res_after.scalar_one_or_none()
    assert lock_after is None
