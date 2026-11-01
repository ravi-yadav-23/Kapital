'use client'

import React from 'react'
import { formatINR, formatDate, formatRelativeDate } from '@/lib/formatters'

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
        <h3 className="text-sm font-medium text-[var(--ink-1)]">
          ASBA Locks ({locks.length})
        </h3>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[var(--ink-3)]">Total Blocked:</span>
          <span className="text-[var(--ink-1)] font-medium tabular-nums">{formatINR(totalLocked)}</span>
        </div>
      </div>

      {locks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target IPO</th>
                <th>Account</th>
                <th className="text-right">Blocked Amount</th>
                <th>Blocked Date</th>
                <th>Release Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-[var(--ink-1)]">
                    {item.ipoName}
                  </td>
                  <td className="text-[var(--ink-2)]">
                    {item.accountName}
                  </td>
                  <td className="text-right font-mono text-xs text-[var(--ink-1)] font-medium tabular-nums">
                    {formatINR(item.amount)}
                  </td>
                  <td className="font-mono text-2xs text-[var(--ink-3)]">
                    {formatDate(item.lockDate)}
                  </td>
                  <td className="font-mono text-2xs text-[var(--ink-2)]">
                    <span>{formatDate(item.releaseDate)}</span>
                    <span className="ml-1.5 text-2xs text-[var(--ink-3)]">
                      ({formatRelativeDate(item.releaseDate)})
                    </span>
                  </td>
                  <td>
                    {item.isConflict ? (
                      <span className="status-pill status-pill-negative">
                        <span className="status-dot status-dot-negative" />
                        Conflict
                      </span>
                    ) : (
                      <span className="status-pill status-pill-neutral">
                        <span className="status-dot status-dot-neutral" />
                        Auto-recycling
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center rounded border border-dashed border-[var(--border-default)]">
          <p className="text-xs text-[var(--ink-2)]">No active ASBA fund locks.</p>
          <p className="text-2xs text-[var(--ink-3)] mt-1">
            Mandate locks and refund release dates appear automatically once applications are submitted.
          </p>
        </div>
      )}
    </div>
  )
}
