'use client'

import React from 'react'
import { AiReport } from '@/types'
import { ScoreBadge } from '../shared/ScoreBadge'
import { formatDate } from '@/lib/formatters'
import { getRecommendationLabel } from '@/lib/formatters'

interface ReportCardProps {
  report: AiReport
  isActive?: boolean
  onSelect: (report: AiReport) => void
}

export function ReportCard({ report, isActive, onSelect }: ReportCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(report)}
      className={`w-full text-left card p-3.5 space-y-2 transition-colors ${
        isActive ? 'border-brand-from/50 shadow-md shadow-brand-from/10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-primary truncate">{report.ipo_name}</p>
          <p className="text-[10px] font-mono text-text-muted">{report.ipo_symbol}</p>
        </div>
        <ScoreBadge score={report.score} size="sm" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-text-accent">
          {getRecommendationLabel(report.recommendation)}
        </span>
        <span className="text-2xs font-mono text-text-muted">{formatDate(report.generated_at)}</span>
      </div>
    </button>
  )
}
