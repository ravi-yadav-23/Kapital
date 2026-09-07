'use client'

import React from 'react'
import { formatINR, formatDate } from '@/lib/formatters'
import { Clock, ShieldCheck, AlertCircle, Lock, Sparkles } from 'lucide-react'

export interface BlockedItem {
  id: string
  accountName: string
  ipoName: string
  amount: number
  lockDate: string
  releaseDate: string
  nextIpoConflict?: string
  isConflict?: boolean
}

interface FundLockTimelineProps {
  locks?: BlockedItem[]
}

export function FundLockTimeline({ locks = [] }: FundLockTimelineProps) {
  const totalLocked = locks.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-accent-amber" />
          <h3 className="text-sm font-semibold text-text-primary">
            ASBA Fund Lock & Liquidity Recycling Timeline
          </h3>
        </div>

        <div className="flex items-center gap-2 text-2xs font-mono">
          <span className="text-text-muted">Total Blocked:</span>
          <span className="text-accent-amber font-bold">{formatINR(totalLocked)}</span>
        </div>
      </div>

      {locks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {locks.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-surface-elevated/50 border border-border-subtle flex flex-col justify-between gap-2.5 hover:bg-surface-elevated/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-text-primary block">{item.ipoName}</span>
                  <span className="text-[11px] text-text-muted">Account: {item.accountName}</span>
                </div>
                <span className="text-xs font-mono font-bold text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded">
                  {formatINR(item.amount)}
                </span>
              </div>

              {/* Lock Date -> Release Date visual bar */}
              <div className="p-2 rounded-lg bg-surface-card border border-border-subtle space-y-1.5 text-2xs font-mono">
                <div className="flex justify-between text-text-muted">
                  <span>Blocked: {formatDate(item.lockDate)}</span>
                  <span className="text-accent-green font-semibold">Refund/Release: {formatDate(item.releaseDate)}</span>
                </div>

                {/* Progress track */}
                <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-accent-amber/80 rounded-full w-2/3" />
                </div>
              </div>

              {/* Pipeline Recycling Status */}
              <div className="flex items-center gap-1.5 text-2xs">
                {item.isConflict ? (
                  <div className="flex items-center gap-1 text-accent-red font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Lock conflict with next issue</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-accent-green font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{item.nextIpoConflict || 'Funds will recycle automatically'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center rounded-xl bg-surface-elevated/40 border border-border-subtle flex flex-col items-center justify-center gap-2">
          <div className="w-9 h-9 rounded-full bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center text-accent-amber mb-1">
            <Lock className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-text-primary">No Active ASBA Fund Locks</p>
          <p className="text-2xs text-text-muted max-w-sm">
            When you apply for open IPOs, your bank ASBA mandate blocks and refund release dates will be tracked here in real-time.
          </p>
        </div>
      )}
    </div>
  )
}

