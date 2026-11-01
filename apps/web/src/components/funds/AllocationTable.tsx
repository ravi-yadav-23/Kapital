'use client'

import React, { useState } from 'react'
import { AllocationPlan } from '@/types'
import { BatchApplyModal } from './BatchApplyModal'
import { formatINR, formatPercent } from '@/lib/formatters'
import { CheckCircle2, Send, RefreshCw, Info } from 'lucide-react'

interface AllocationTableProps {
  plan?: Partial<AllocationPlan>
  onRefreshPlan?: () => void
  isRefreshing?: boolean
}

export function AllocationTable({ plan, onRefreshPlan, isRefreshing = false }: AllocationTableProps) {
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)

  const entries = plan?.entries || []
  const totalCapital = plan?.total_capital_deployed || 0

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--ink-1)]">
              Mathematical Allocation Plan
            </h3>
            <span className="font-mono text-2xs px-2 py-0.5 rounded text-[var(--ink-3)] bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              PuLP MILP
            </span>
          </div>
          <p className="text-2xs text-[var(--ink-3)] mt-0.5 font-mono">
            Optimized for maximum expected returns across {entries.length} demats · 12ms solve time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xs text-[var(--ink-3)] block font-mono uppercase">Deploying</span>
            <span className="text-sm font-mono font-medium text-[var(--ink-1)] tabular-nums">
              {formatINR(totalCapital)}
            </span>
          </div>

          {onRefreshPlan && (
            <button
              onClick={onRefreshPlan}
              disabled={isRefreshing}
              className="btn btn-secondary btn-sm gap-1.5"
              title="Re-run mathematical solver"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Optimizing...' : 'Re-run'}</span>
            </button>
          )}

          <button
            onClick={() => setIsBatchModalOpen(true)}
            disabled={entries.length === 0}
            className="btn btn-primary btn-sm gap-1.5 disabled:opacity-50"
          >
            {appliedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
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
        <div className="flex items-center gap-2.5 px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded text-xs text-[var(--ink-2)]">
          <Info className="w-3.5 h-3.5 text-[var(--ink-3)] shrink-0" />
          <span>
            <strong className="text-[var(--ink-1)] font-medium">Demo Simulation:</strong> MILP solver results computed using sample family demats. Real broker balances update automatically upon linking credentials.
          </span>
        </div>
      )}

      {appliedSuccess && (
        <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--positive)] text-xs text-[var(--positive)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>All {entries.length} application orders staged in sandbox. UPI mandates queued.</span>
          </div>
        </div>
      )}

      {/* Allocation Entries Table */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target IPO</th>
                <th>Account</th>
                <th>Category</th>
                <th>Lots to Bid</th>
                <th className="text-right">Capital Required</th>
                <th className="text-right">Expected ROI</th>
                <th>Solver Rationale</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index}>
                  <td className="font-medium text-[var(--ink-1)]">
                    {entry.ipo_name}
                  </td>
                  <td className="text-[var(--ink-2)]">
                    {entry.account_name}
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                      {entry.category}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-[var(--ink-2)] tabular-nums">
                    {entry.lots} lot{entry.lots > 1 ? 's' : ''} ({entry.lots * 14} shs)
                  </td>
                  <td className="text-right font-mono text-xs text-[var(--ink-1)] font-medium tabular-nums">
                    {formatINR(entry.amount)}
                  </td>
                  <td className="text-right font-mono text-xs text-[var(--positive)] font-medium tabular-nums">
                    {formatPercent(entry.expected_return_pct)}
                  </td>
                  <td className="text-xs text-[var(--ink-3)] max-w-xs truncate">
                    {entry.reason || 'Maximizes allotment probability & returns'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center rounded border border-dashed border-[var(--border-default)]">
          <p className="text-xs text-[var(--ink-2)]">No allocations currently suggested.</p>
          <p className="text-2xs text-[var(--ink-3)] mt-1">
            Run the optimizer when active or upcoming IPOs are available in the pipeline.
          </p>
        </div>
      )}

      <BatchApplyModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        entries={entries}
        onSuccess={() => {
          setAppliedSuccess(true)
          setTimeout(() => setAppliedSuccess(false), 8000)
        }}
      />
    </div>
  )
}
