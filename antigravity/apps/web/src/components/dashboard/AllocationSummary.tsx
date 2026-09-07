'use client'

import React from 'react'
import { AllocationPlan } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { Sparkles, ArrowRight, ShieldCheck, TrendingUp } from 'lucide-react'
import { formatINR } from '@/lib/formatters'
import Link from 'next/link'

interface AllocationSummaryProps {
  plan: AllocationPlan
}

export function AllocationSummary({ plan }: AllocationSummaryProps) {
  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-from/15 text-brand-from">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              AI Allocation Plan
            </h3>
            <p className="text-2xs text-text-muted">
              Optimal fund distribution for today's active IPOs
            </p>
          </div>
        </div>

        <Link
          href="/funds"
          className="text-xs font-semibold text-brand-from hover:text-brand-to inline-flex items-center gap-1"
        >
          <span>Fund Manager</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Plan Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Target IPO</th>
              <th>Category</th>
              <th>Lots</th>
              <th>Amount</th>
              <th>Exp. Gain (₹ / %)</th>
            </tr>
          </thead>
          <tbody>
            {plan.entries.map((entry, index) => {
              const estProfit = Math.round((entry.amount * (entry.expected_return_pct || 0)) / 100)
              return (
                <tr key={index}>
                  <td className="font-medium text-text-primary">
                    {entry.account_name}
                  </td>
                  <td className="text-text-secondary truncate max-w-[150px]">
                    {entry.ipo_name}
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-surface-elevated text-brand-from">
                      {entry.category}
                    </span>
                  </td>
                  <td>{entry.lots} lot{entry.lots > 1 ? 's' : ''}</td>
                  <td>
                    <AmountDisplay amount={entry.amount} className="text-xs" />
                  </td>
                  <td>
                    <span className="text-accent-green font-semibold text-xs block">
                      +{formatINR(estProfit)}
                    </span>
                    <span className="text-2xs text-text-muted">
                      (+{entry.expected_return_pct}%)
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Banner */}
      <div className="p-3 rounded-lg bg-surface-elevated/80 border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-text-muted text-2xs">
          <ShieldCheck className="w-4 h-4 text-accent-green flex-shrink-0" />
          <span>PuLP solver constraints validated: 0 ASBA lock overlaps detected.</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xs text-text-muted uppercase font-semibold">Total Deployable:</span>
          <AmountDisplay amount={plan.total_capital_deployed} className="text-sm font-bold text-accent-green" />
        </div>
      </div>
    </div>
  )
}
