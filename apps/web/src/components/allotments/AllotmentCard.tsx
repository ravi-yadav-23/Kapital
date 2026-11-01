'use client'

import React from 'react'
import { Allotment } from '@/types'
import { formatDate, formatINR, getStatusDotClass } from '@/lib/formatters'

interface AllotmentCardProps {
  allotment: Allotment
  onSellTrigger?: (allotment: Allotment) => void
}

export function AllotmentCard({ allotment, onSellTrigger }: AllotmentCardProps) {
  const isActive = allotment.status === 'ACTIVE'
  const isSold = allotment.status === 'SOLD'

  const estGain = Math.round((allotment.invested_amount * (allotment.roi_percent || 0)) / 100)

  return (
    <div className="card p-4 space-y-3">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink-1)]">
            {allotment.ipo_name}
          </h3>
          <span className="text-2xs text-[var(--ink-3)] block font-mono">
            {allotment.ipo_symbol} · {allotment.account_name}
          </span>
        </div>

        <div className="status-pill status-pill-neutral">
          <span className={`status-dot ${getStatusDotClass(allotment.status)}`} />
          <span>{isActive ? 'Active' : isSold ? 'Sold' : 'Unallotted'}</span>
        </div>
      </div>

      {/* Figures Grid */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-default)] text-xs">
        <div>
          <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Shares</span>
          <span className="font-mono text-[var(--ink-1)] tabular-nums">
            {allotment.allotted_shares} shs @ ₹{allotment.issue_price}
          </span>
        </div>

        <div className="text-right">
          <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Invested</span>
          <span className="font-mono text-[var(--ink-1)] font-medium tabular-nums">
            {formatINR(allotment.invested_amount)}
          </span>
        </div>

        {isSold ? (
          <>
            <div>
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Sold At</span>
              <span className="font-mono text-[var(--ink-2)] tabular-nums">
                ₹{allotment.sell_price} · {formatDate(allotment.sell_date)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Realized P&L</span>
              <span className="font-mono text-[var(--positive)] font-medium tabular-nums">
                +₹{allotment.realized_pnl?.toLocaleString('en-IN')} (+{allotment.roi_percent}%)
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Listing Date</span>
              <span className="font-mono text-[var(--ink-2)]">
                {formatDate(allotment.listing_date)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Est. Gain</span>
              <span className="font-mono text-[var(--positive)] font-medium tabular-nums">
                +{formatINR(estGain)} (+{allotment.roi_percent}%)
              </span>
            </div>
          </>
        )}
      </div>

      {isActive && onSellTrigger && (
        <div className="pt-2 border-t border-[var(--border-default)]">
          <button
            onClick={() => onSellTrigger(allotment)}
            className="btn btn-secondary btn-sm w-full justify-center"
          >
            Stage Pre-Listing Sell
          </button>
        </div>
      )}
    </div>
  )
}
