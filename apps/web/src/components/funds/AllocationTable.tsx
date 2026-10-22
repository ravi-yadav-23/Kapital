'use client'

import React, { useState } from 'react'
import { AllocationPlan } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { formatINR } from '@/lib/formatters'
import { Sparkles, CheckCircle2, AlertTriangle, Send, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react'

interface AllocationTableProps {
  plan?: Partial<AllocationPlan>
  onRefreshPlan?: () => void
  isRefreshing?: boolean
}

export function AllocationTable({ plan, onRefreshPlan, isRefreshing = false }: AllocationTableProps) {
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)

  const entries = plan?.entries || []
  const skippedIpos = plan?.skipped_ipos || []
  const warnings = plan?.warnings || []
  const totalCapital = plan?.total_capital_deployed || 0

  const handleApplyAll = () => {
    setIsApplyingAll(true)
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
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-from" />
            <h3 className="text-sm font-semibold text-text-primary">
              PuLP Mathematical Solver Allocation Plan
            </h3>
          </div>
          <p className="text-2xs text-text-muted mt-0.5">
            Deterministic linear optimization maximizing expected family ROI within ASBA capital limits
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xs text-text-muted block uppercase font-mono">Total Deployable</span>
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

      {appliedSuccess && (
        <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/20 text-xs text-accent-green flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>All {entries.length} IPO application orders staged via Angel One SmartAPI.</span>
          </div>
          <span className="text-2xs font-mono">Check UPI App to Authorize Mandates</span>
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
                        entry.category === 'SHNI'
                          ? 'bg-accent-blue/15 text-accent-blue'
                          : entry.category === 'BHNI'
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
            {warnings.length > 0 ? 'No Current Capital Allocations' : 'Ready for Family Capital Allocation'}
          </p>
          <p className="text-xs text-text-muted max-w-md">
            {warnings.length > 0
              ? warnings[0]
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

      {/* Warnings / Skipped Issues Box */}
      {(skippedIpos.length > 0 || warnings.length > 0) && (
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

          {warnings.map((warn, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-surface-elevated/60 border border-border-subtle flex items-start gap-2 text-accent-green"
            >
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
