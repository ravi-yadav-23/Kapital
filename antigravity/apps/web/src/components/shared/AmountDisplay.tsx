'use client'

import React from 'react'
import { formatINR, formatCompactINR } from '@/lib/formatters'

interface AmountDisplayProps {
  amount: number | undefined | null
  compact?: boolean
  includeDecimals?: boolean
  className?: string
}

export function AmountDisplay({
  amount,
  compact = false,
  includeDecimals = false,
  className = '',
}: AmountDisplayProps) {
  const formatted = compact ? formatCompactINR(amount) : formatINR(amount, includeDecimals)

  return (
    <span className={`mono font-semibold tracking-tight text-text-primary ${className}`}>
      {formatted}
    </span>
  )
}
