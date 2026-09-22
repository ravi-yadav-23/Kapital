'use client'

import React from 'react'
import { formatINR, formatPercent } from '@/lib/formatters'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface PnlDisplayProps {
  amount?: number
  percent?: number
  showIcon?: boolean
  className?: string
}

export function PnlDisplay({
  amount,
  percent,
  showIcon = true,
  className = '',
}: PnlDisplayProps) {
  const isPositive = (amount ?? percent ?? 0) > 0
  const isNegative = (amount ?? percent ?? 0) < 0
  const isZero = !isPositive && !isNegative

  const colorClass = isPositive
    ? 'pnl-positive'
    : isNegative
    ? 'pnl-negative'
    : 'pnl-neutral'

  return (
    <div className={`inline-flex items-center gap-1 mono font-semibold ${colorClass} ${className}`}>
      {showIcon && isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
      {showIcon && isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
      {amount !== undefined && (
        <span>
          {isPositive ? '+' : ''}
          {formatINR(amount)}
        </span>
      )}
      {percent !== undefined && (
        <span className="text-xs opacity-90">
          ({formatPercent(percent, true)})
        </span>
      )}
      {isZero && amount === undefined && percent === undefined && <span>₹0</span>}
    </div>
  )
}
