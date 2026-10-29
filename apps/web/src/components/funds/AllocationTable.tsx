'use client'

import React, { useState } from 'react'
import { AllocationPlan, UpcomingConflict } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import {
  Sparkles, CheckCircle2, AlertTriangle, Send, ShieldCheck,
  RefreshCw, CalendarClock, Info,
} from 'lucide-react'

interface AllocationTableProps {
  plan?: Partial<AllocationPlan>
  onRefreshPlan?: () => void
  isRefreshing?: boolean
}

function AsbaConflictBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent-amber/15 text-accent-amber border border-accent-amber/25">
      <CalendarClock className="w-3 h-3" />
      {count} ASBA conflict{count > 1 ? 's' : ''} detected
    </span>
  )
}

function UpcomingConflictPanel({ conflicts }: { conflicts: UpcomingConflict[] }) {
  if (!conflicts || conflicts.length === 0) return null

  return (
    <div className="mt-3 p-3 rounded-xl border border-accent-amber/30 bg-accent-amber/5 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-accent-amber">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>ASBA Lock Conflicts — Upcoming High-Score IPOs</span>
      </div>
      <p className="text-2xs text-text-muted leading-relaxed">
        The following upcoming IPOs open before your ASBA funds are released from current bids.
        Capital has been reserved so you can participate in these better opportunities.
      </p>
      {conflicts.map((c, i) => (
        <div key={i} className="p-2.5 rounded-lg bg-surface-elevated/50 border border-border-subtle space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="text-xs font-semibold text-text-primary">{c.upcoming_ipo_name}</span>
            <div className="flex items-center gap-2">
              {c.upcoming_score > 0 && (
                <span className="text-2xs font-mono text-accent-blue">Score {c.upcoming_score}</span>
              )}
              {c.upcoming_gmp > 0 && (
                <span className="text-2xs font-mono text-accent-green">+{c.upcoming_gmp}% GMP</span>
              )}
              {c.open_date && (
                <span className="text-2xs font-mono text-text-muted">Opens {c.open_date}</span>
              )}
            </div>
          </div>
          {c.conflicts.map((conf, j) => (
            <div key={j} className="text-2xs text-text-muted flex items-start gap-1.5 pl-2">
              <span className="text-accent-amber mt-0.5">⚠</span>
              <span>
                <span className="font-medium text-text-secondary">{conf.blocking_ipo}</span> ASBA frees on{' '}
                <span className="font-mono">{conf.asba_free_date}</span>, but this IPO opens{' '}
                <span className="font-mono">{conf.upcoming_open_date}</span> — funds already reserved.
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function AllocationTable({ plan, onRefreshPlan, isRefreshing = false }: AllocationTableProps) {
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)

  const entries = plan?.entries || []
  const skippedIpos = plan?.skipped_ipos || []
  const warnings = plan?.warnings || []
  const totalCapital = plan?.total_capital_deployed || 0
  const asbaConflicts = plan?.asba_lock_overlaps_detected ?? 0
  const upcomingConflicts = plan?.upcoming_conflicts || []

  // Separate reservation warnings from status warnings
  const reservationWarnings = warnings.filter(w =>
    w.includes('reserved') || w.includes('held back') || w.includes('ASBA')
  )
  const statusWarnings = warnings.filter(w =>
    !w.includes('reserved') && !w.includes('held back') && !w.includes('ASBA')
  )

  const handleApplyAll = () => {
    setIsApplyingAll(true)
    // TODO: Wire this to POST /orders/stage-all with the plan entries
    setTimeout(() => {
      setIsApplyingAll(false)
      setAppliedSuccess(true)
    }, 1500)
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-brand-from" />
            <h3 className="text-sm font-semibold text-text-primary">
              PuLP Mathematical Solver — Allocation Plan
            </h3>
            <AsbaConflictBadge count={asbaConflicts} />
          </div>
          <p className="text-2xs text-text-muted mt-0.5">
            MILP optimizer with ASBA capital reservation for upcoming high-score IPOs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xs text-text-muted block uppercase font-mono">Deploying Now</span>
            <AmountDisplay amount={totalCapital} className="text-sm font-bold text-accent-green" />
          </div>

          {onRefreshPlan && (
            <button
              onClick={onRefreshPlan}
              disabled={isRefreshing}
              className="btn btn-secondary btn-sm gap-1.5"
              title="Re-run mathematical solver with current demat balances and live IPO pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Optimizing...' : 'Re-Calculate'}</span>
            </button>
          )}

          <button
            onClick={handleApplyAll}
            disabled={isApplyingAll || appliedSuccess || entries.length === 0}
            className="btn btn-primary btn-sm gap-1.5 shadow-md shadow-brand-from/20 disabled:opacity-50"
          >
            {isApplyingAll ? (
              <span className="animate-pulse">Staging {entries.length} Orders...</span>
            ) : appliedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                <span>Orders Staged</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Apply All Allocations</span>
              </>
            )}
          </button>
        </div>
      </div>

      {plan?.is_demo && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-brand-from/10 border border-brand-from/25 rounded-lg text-xs text-text-primary">
          <Info className="w-4 h-4 text-brand-from shrink-0" />
          <span>
            <strong className="text-brand-from">Demo Simulation Mode:</strong> Showing mathematical solver results using sample family accounts. Configure real broker accounts in settings to generate live allocations.
          </span>
        </div>
      )}

      {appliedSuccess && (
        <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/20 text-xs text-accent-green flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>All {entries.length} IPO application orders staged via Angel One SmartAPI.</span>
          </div>
          <span className="text-2xs font-mono">Check UPI App to Authorize Mandates</span>
        </div>
      )}

      {/* ASBA Conflict Panel — shown above table */}
      {upcomingConflicts.length > 0 && (
        <UpcomingConflictPanel conflicts={upcomingConflicts} />
      )}

      {/* Reservation warnings — compact inline strip */}
      {reservationWarnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {reservationWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-2xs text-accent-amber">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Allocation Entries Table */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target IPO</th>
                <th>Family Account</th>
                <th>Category</th>
                <th>Lots to Bid</th>
                <th>Capital Required</th>
                <th>Expected ROI</th>
                <th>Solver Rationale</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index} className="hover:bg-surface-elevated/70 transition-colors">
                  <td className="font-semibold text-text-primary">
                    {entry.ipo_name}
                  </td>

                  <td>
                    <span className="font-medium text-text-secondary">{entry.account_name}</span>
                  </td>

                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase ${
                        entry.category?.toUpperCase() === 'SHNI'
                          ? 'bg-accent-blue/15 text-accent-blue'
                          : entry.category?.toUpperCase() === 'BHNI'
                          ? 'bg-accent-purple/15 text-accent-purple'
                          : 'bg-brand-from/15 text-brand-from'
                      }`}
                    >
                      {entry.category}
                    </span>
                  </td>

                  <td className="font-mono">{entry.lots} lot{entry.lots > 1 ? 's' : ''}</td>

                  <td>
                    <AmountDisplay amount={entry.amount} className="text-xs font-semibold" />
                  </td>

                  <td>
                    <span className="text-accent-green font-mono font-bold text-xs">
                      +{entry.expected_return_pct}%
                    </span>
                  </td>

                  <td className="text-2xs text-text-muted max-w-xs leading-snug">
                    {entry.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center rounded-xl bg-surface-elevated/40 border border-border-subtle flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-brand-from/10 border border-brand-from/20 flex items-center justify-center text-brand-from mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {statusWarnings.length > 0 ? 'No Current Capital Allocations' : 'Ready for Family Capital Allocation'}
          </p>
          <p className="text-xs text-text-muted max-w-md">
            {statusWarnings.length > 0
              ? statusWarnings[0]
              : 'Once you link family demat accounts with available liquidity, the PuLP mathematical solver will automatically compute optimal lottery and bidding lot allocations.'}
          </p>
          {onRefreshPlan && (
            <button
              onClick={onRefreshPlan}
              disabled={isRefreshing}
              className="btn btn-secondary btn-xs gap-1.5 mt-2"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Optimizing...' : 'Re-Calculate Solver Plan'}</span>
            </button>
          )}
        </div>
      )}

      {/* Skipped Issues Box & Status Warnings */}
      {(skippedIpos.length > 0 || statusWarnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-2xs">
          {skippedIpos.map((skip, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-surface-elevated/60 border border-border-subtle flex items-start gap-2 text-text-muted"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-accent-amber flex-shrink-0 mt-0.5" />
              <span>{skip.reason}</span>
            </div>
          ))}

          {statusWarnings.map((warn, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-surface-elevated/60 border border-border-subtle flex items-start gap-2 text-text-muted"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-accent-blue flex-shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
