"""
pnl_service.py — Realized P&L Ledger Service

Writes a RealizedPnl record whenever a pre-listing sell or manual sell is confirmed.
Provides summary aggregation for the dashboard.
"""
from typing import Dict, Any, Optional, List
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.pnl import RealizedPnl
from app.models.allotment import Allotment
import logging

logger = logging.getLogger("pnl_service")


class PnlService:

    @staticmethod
    async def record_sell(
        db: AsyncSession,
        allotment: Allotment,
        exit_price: float,
        exit_type: str = "PRE_MARKET_LISTING",
    ) -> Optional[RealizedPnl]:
        """
        Create a RealizedPnl record for a completed sell.
        Called by scheduler/listing sell after confirming order fill.
        Idempotent: skips if a record for this allotment already exists.
        """
        # Idempotency guard — one record per allotment
        existing = await db.execute(
            select(RealizedPnl).where(RealizedPnl.allotment_id == allotment.id)
        )
        if existing.scalar_one_or_none():
            logger.info(f"[PnL] Record already exists for allotment {allotment.id} — skipping.")
            return None

        shares = allotment.allotted_shares or 0
        issue_px = allotment.issue_price or 0.0
        invested = round(shares * issue_px, 2)
        realized = round(shares * exit_price, 2)
        gross_pnl = round(realized - invested, 2)

        # Statutory Indian equity transaction costs & frictional deductions:
        # 1. STT (Securities Transaction Tax): 0.1% on delivery sell turnover
        stt = round(realized * 0.001, 2)
        # 2. DP Charges (Depository Participant debit fee): ₹15.34 (Angel One + CDSL)
        dp_charge = 15.34
        # 3. Exchange turnover charges: ~0.003% (NSE delivery)
        exchange_turnover = round(realized * 0.00003, 2)
        # 4. SEBI turnover fee: ₹10 per crore
        sebi_charges = round(realized * 0.000001, 2)
        # 5. GST (18%) on DP charges and exchange turnover fees
        gst = round((dp_charge + exchange_turnover) * 0.18, 2)

        total_friction = round(stt + dp_charge + exchange_turnover + sebi_charges + gst, 2)
        net_pnl = round(gross_pnl - total_friction, 2)
        roi = round((net_pnl / invested * 100), 4) if invested else 0.0

        record = RealizedPnl(
            allotment_id=allotment.id,
            account_id=allotment.account_id,
            account_name=allotment.account_name,
            ipo_name=allotment.ipo_name,
            ipo_symbol=allotment.ipo_symbol,
            shares_sold=shares,
            issue_price=issue_px,
            exit_price=exit_price,
            invested_amount=invested,
            realized_amount=realized,
            net_pnl=net_pnl,
            roi_percent=roi,
            exit_date=date.today(),
            exit_type=exit_type,
        )
        db.add(record)

        # Mirror onto allotment row for fast allotment-list display
        allotment.sell_price = exit_price
        allotment.sell_date = date.today()
        allotment.realized_pnl = net_pnl
        allotment.roi_percent = roi
        allotment.status = "SOLD"

        await db.flush()
        logger.info(
            f"[PnL] Recorded: {allotment.ipo_symbol} — "
            f"{shares} shares @ ₹{exit_price} | Net P&L ₹{net_pnl} ({roi}%)"
        )
        try:
            from app.routers.websocket import broadcast_event
            await broadcast_event("SELL_EXECUTED", {
                "allotment_id": allotment.id,
                "ipo_symbol": allotment.ipo_symbol,
                "exit_price": exit_price,
                "net_pnl": net_pnl,
                "roi_percent": roi,
            })
        except Exception:
            pass
        return record

    @staticmethod
    async def get_summary(db: AsyncSession) -> Dict[str, Any]:
        """
        Aggregate P&L summary for dashboard display.
        Returns total invested, total realized, net P&L, ROI %, and per-IPO breakdown.
        """
        stmt = select(RealizedPnl).order_by(RealizedPnl.exit_date.desc())
        res = await db.execute(stmt)
        records: List[RealizedPnl] = res.scalars().all()

        total_invested = sum(r.invested_amount for r in records)
        total_realized = sum(r.realized_amount for r in records)
        total_net_pnl = sum(r.net_pnl for r in records)
        overall_roi = round((total_net_pnl / total_invested * 100), 2) if total_invested else 0.0

        wins = [r for r in records if r.net_pnl > 0]
        losses = [r for r in records if r.net_pnl <= 0]

        breakdown = [
            {
                "ipo_symbol": r.ipo_symbol,
                "ipo_name": r.ipo_name,
                "account_name": r.account_name,
                "shares_sold": r.shares_sold,
                "issue_price": r.issue_price,
                "exit_price": r.exit_price,
                "invested_amount": r.invested_amount,
                "realized_amount": r.realized_amount,
                "net_pnl": r.net_pnl,
                "roi_percent": r.roi_percent,
                "exit_date": r.exit_date.isoformat() if r.exit_date else None,
                "exit_type": r.exit_type,
            }
            for r in records
        ]

        return {
            "total_invested": round(total_invested, 2),
            "total_realized": round(total_realized, 2),
            "total_net_pnl": round(total_net_pnl, 2),
            "overall_roi_percent": overall_roi,
            "total_trades": len(records),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate_percent": round(len(wins) / len(records) * 100, 1) if records else 0.0,
            "breakdown": breakdown,
        }


pnl_service = PnlService()
