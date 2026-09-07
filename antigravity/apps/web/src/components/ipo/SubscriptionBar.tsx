'use client'

import React from 'react'
import { formatSubscriptionMultiple } from '@/lib/formatters'

interface SubscriptionBarProps {
  retail?: number
  shni?: number
  bhni?: number
  total?: number
  compact?: boolean
}

export function SubscriptionBar({
  retail = 0,
  shni = 0,
  bhni = 0,
  total = 0,
  compact = false,
}: SubscriptionBarProps) {
  // If no subscription data yet (e.g. upcoming issue)
  if (!total && !retail && !shni && !bhni) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-2xs text-text-muted">
          <span>Subscription:</span>
          <span className="font-mono">Bidding not started</span>
        </div>
        <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
          <div className="h-full bg-border-subtle w-0" />
        </div>
      </div>
    )
  }

  // Calculate percentage widths for a normalized mini visual bar (capped at max 100% display)
  const maxSub = Math.max(total, retail, shni, bhni, 1)
  const retailPct = Math.min((retail / maxSub) * 100, 100)
  const shniPct = Math.min((shni / maxSub) * 100, 100)
  const bhniPct = Math.min((bhni / maxSub) * 100, 100)

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-2xs">
          <span className="text-text-muted">Live Subscription:</span>
          <span className="font-mono font-bold text-text-primary">
            {formatSubscriptionMultiple(total)} Total
          </span>
        </div>

        {/* 3-layer segment bar */}
        <div className="h-1.5 w-full bg-surface-elevated rounded-full flex gap-0.5 overflow-hidden">
          <div
            className="bg-brand-from h-full rounded-l-full transition-all duration-500"
            style={{ width: `${retailPct}%` }}
            title={`Retail: ${formatSubscriptionMultiple(retail)}`}
          />
          <div
            className="bg-accent-blue h-full transition-all duration-500"
            style={{ width: `${shniPct}%` }}
            title={`sHNI: ${formatSubscriptionMultiple(shni)}`}
          />
          <div
            className="bg-accent-purple h-full rounded-r-full transition-all duration-500"
            style={{ width: `${bhniPct}%` }}
            title={`bHNI: ${formatSubscriptionMultiple(bhni)}`}
          />
        </div>

        <div className="flex justify-between text-[10px] text-text-muted font-mono pt-0.5">
          <span className="text-brand-from">Ret: {formatSubscriptionMultiple(retail)}</span>
          <span className="text-accent-blue">sHNI: {formatSubscriptionMultiple(shni)}</span>
          <span className="text-accent-purple">bHNI: {formatSubscriptionMultiple(bhni)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-surface-elevated/50 border border-border-subtle">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-text-secondary">Subscription Status</span>
        <span className="font-mono font-bold text-text-primary bg-surface-elevated px-2 py-0.5 rounded border border-border-subtle">
          Total: {formatSubscriptionMultiple(total)}
        </span>
      </div>

      <div className="space-y-2 text-2xs font-mono">
        <div>
          <div className="flex justify-between text-text-secondary mb-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-from inline-block" />
              Retail (RII ≤ ₹2L)
            </span>
            <span className="font-semibold text-text-primary">{formatSubscriptionMultiple(retail)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-card overflow-hidden">
            <div
              className="h-full bg-brand-from rounded-full"
              style={{ width: `${Math.min(retail * 10, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-text-secondary mb-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-blue inline-block" />
              Small HNI (sHNI ₹2L-₹10L)
            </span>
            <span className="font-semibold text-text-primary">{formatSubscriptionMultiple(shni)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-card overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full"
              style={{ width: `${Math.min(shni * 5, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-text-secondary mb-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-purple inline-block" />
              Big HNI (bHNI &gt; ₹10L)
            </span>
            <span className="font-semibold text-text-primary">{formatSubscriptionMultiple(bhni)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-card overflow-hidden">
            <div
              className="h-full bg-accent-purple rounded-full"
              style={{ width: `${Math.min(bhni * 2, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
