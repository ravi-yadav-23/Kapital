'use client'

import React from 'react'
import { IpoStatus } from '@/types'
import { getStatusPillClass, getStatusLabel } from '@/lib/formatters'

interface StatusPillProps {
  status: IpoStatus
  className?: string
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const pillClass = getStatusPillClass(status)
  const label = getStatusLabel(status)

  return (
    <span className={`status-pill ${pillClass} ${className}`}>
      {status === 'open' && <span className="dot-pulse" />}
      {status === 'closing_today' && <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-ping" />}
      {label}
    </span>
  )
}
