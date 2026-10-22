import logging
from typing import Dict, Any
from sqlalchemy import select, func

from app.db.database import AsyncSessionLocal
from app.models.account import FamilyAccount
from app.models.allotment import AsbaLock

logger = logging.getLogger("tasks.fund")


async def reconcile_family_funds() -> Dict[str, Any]:
    """
    Nightly fund audit:
    Reconciles family demat balances against actual active AsbaLock records.
    Corrects any drift between account.locked_asba_balance and sum of AsbaLock records.
    """
    logger.info("Starting nightly family fund reconciliation audit...")
    reconciled_accounts = 0
    total_reconciled_locked = 0.0

    async with AsyncSessionLocal() as db:
        # Fetch all accounts
        acc_stmt = select(FamilyAccount)
        res_acc = await db.execute(acc_stmt)
        accounts = res_acc.scalars().all()

        for acc in accounts:
            # Sum up actual active locks for this account
            lock_stmt = select(func.sum(AsbaLock.amount)).where(AsbaLock.account_id == acc.id)
            res_lock = await db.execute(lock_stmt)
            actual_locked = res_lock.scalar() or 0.0

            # Check if there is drift
            recorded_locked = acc.locked_asba_balance or 0.0
            if abs(recorded_locked - actual_locked) > 0.01:
                logger.warning(
                    f"[{acc.name}] ASBA Lock drift detected! Recorded: ₹{recorded_locked}, "
                    f"Actual: ₹{actual_locked}. Adjusting balance..."
                )
                acc.locked_asba_balance = actual_locked
                # Adjust available liquid balance
                total_demat = acc.total_demat_balance or 0.0
                acc.available_liquid_balance = max(0.0, total_demat - actual_locked)
                reconciled_accounts += 1

            total_reconciled_locked += actual_locked

        await db.commit()
        if reconciled_accounts > 0:
            from app.services.account_service import _invalidate_accounts_cache
            _invalidate_accounts_cache()
            try:
                from app.routers.websocket import broadcast_event
                await broadcast_event("ASBA_LOCKS_SWEPT", {"accounts_adjusted": reconciled_accounts})
            except Exception:
                pass

    logger.info(
        f"Nightly fund audit completed: {len(accounts)} accounts audited, "
        f"{reconciled_accounts} adjustments made, Total locked: ₹{total_reconciled_locked}"
    )

    return {
        "status": "COMPLETED",
        "accounts_audited": len(accounts),
        "accounts_adjusted": reconciled_accounts,
        "total_locked_asba": total_reconciled_locked,
    }
