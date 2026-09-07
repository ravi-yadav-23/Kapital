'use client'

import React from 'react'
import { Allotment } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { PnlDisplay } from '../shared/PnlDisplay'
import { formatDate, formatINR } from '@/lib/formatters'
import { Clock, Zap, Flame, CheckCircle2, TrendingUp } from 'lucide-react'

interface AllotmentCardProps {
  allotment: Allotment
  onSellTrigger?: (allotment: Allotment) => void
}

export function AllotmentCard({ allotment, onSellTrigger }: AllotmentCardProps) {
  const isActive = allotment.status === 'ACTIVE'
  const isSold = allotment.status === 'SOLD'
  const isInactive = allotment.status === 'INACTIVE'

  const estGain = Math.round((allotment.invested_amount * (allotment.roi_percent || 0)) / 100)

  return (
    <div className="card p-5 flex flex-col justify-between space-y-4 hover:border-brand-from/40 transition-all duration-300 relative overflow-hidden bg-surface-card border-border-default">
      {/* Top Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-text-primary leading-snug">
              {allotment.ipo_name}
            </h3>
            <div className="flex items-center gap-2 text-2xs text-text-secondary mt-0.5">
              <span className="font-semibold text-text-primary">{allotment.ipo_symbol}</span>
              <span>•</span>
              <span>Account: <strong className="text-text-primary">{allotment.account_name}</strong></span>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${
              isActive
                ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
                : isSold
                ? 'bg-accent-green/15 text-accent-green border border-accent-green/30'
                : 'bg-surface-elevated text-text-muted border border-border-subtle'
            }`}
          >
            {isActive ? 'Active (Pre-Listing)' : isSold ? 'Sold' : 'Unallotted'}
          </span>
        </div>

        {/* Numbers Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-elevated border border-border-subtle text-xs">
          <div>
            <span className="text-2xs text-text-muted block">Allotted Quantity</span>
            <span className="font-bold text-text-primary text-sm">
              {allotment.allotted_shares} shares
            </span>
            <span className="text-[11px] text-text-muted block mt-0.5">
              @ ₹{allotment.issue_price} issue price
            </span>
          </div>

          <div>
            <span className="text-2xs text-text-muted block">Capital Invested</span>
            <AmountDisplay amount={allotment.invested_amount} className="text-sm font-bold text-text-primary" />
          </div>

          {/* If SOLD: Display execution metrics */}
          {isSold && (
            <>
              <div>
                <span className="text-2xs text-text-muted block">Sell Price</span>
                <span className="font-bold text-accent-green text-sm">
                  ₹{allotment.sell_price}
                </span>
                <span className="text-[11px] text-text-muted block mt-0.5">
                  {formatDate(allotment.sell_date)}
                </span>
              </div>

              <div>
                <span className="text-2xs text-text-muted block">Realized Profit</span>
                <PnlDisplay amount={allotment.realized_pnl} percent={allotment.roi_percent} />
              </div>
            </>
          )}

          {/* If ACTIVE: Display Expected Listing Metrics */}
          {isActive && (
            <>
              <div>
                <span className="text-2xs text-text-muted block">Listing Date</span>
                <span className="font-bold text-brand-from text-sm">
                  {formatDate(allotment.listing_date)}
                </span>
              </div>

              <div>
                <span className="text-2xs text-text-muted block">Est. Listing Gain (₹ / GMP)</span>
                <div className="flex items-center gap-1.5 text-accent-green font-bold text-sm">
                  <Flame className="w-3.5 h-3.5 fill-accent-green/20" />
                  <span>+{formatINR(estGain)}</span>
                </div>
                <span className="text-[11px] text-text-secondary block mt-0.5">
                  +{allotment.roi_percent}% (₹{allotment.current_price} est.)
                </span>
              </div>
            </>
          )}

          {/* If INACTIVE: Display Refund note */}
          {isInactive && (
            <div className="col-span-2 p-2 rounded-lg bg-surface-card border border-border-subtle flex items-center justify-between text-2xs">
              <span className="text-text-muted">ASBA Mandate Status:</span>
              <span className="text-accent-green font-semibold">Refund Initiated</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Area */}
      {isActive && onSellTrigger && (
        <button
          onClick={() => onSellTrigger(allotment)}
          className="btn btn-primary btn-sm w-full justify-center gap-1.5 font-bold shadow-md shadow-brand-from/20"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Stage Pre-Listing Sell (09:00 AM)</span>
        </button>
      )}

      {isSold && (
        <div className="flex items-center justify-between text-2xs text-text-muted pt-1">
          <span>Order ID: {allotment.sell_order_id}</span>
          <span className="text-accent-green flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Executed
          </span>
        </div>
      )}
    </div>
  )
}