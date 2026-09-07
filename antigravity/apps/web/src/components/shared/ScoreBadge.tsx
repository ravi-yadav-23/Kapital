'use client'

import React from 'react'
import { getScoreBadgeClass, getScoreRecommendation, getRecommendationLabel } from '@/lib/formatters'

interface ScoreBadgeProps {
  score?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ScoreBadge({ score, showLabel = false, size = 'md', className = '' }: ScoreBadgeProps) {
  if (score === undefined || score === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono bg-surface-elevated text-text-muted">
        N/A
      </span>
    )
  }

  const badgeClass = getScoreBadgeClass(score)
  const recommendation = getScoreRecommendation(score)
  const label = getRecommendationLabel(recommendation)

  const sizeClasses = {
    sm: 'text-2xs px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`score-badge ${badgeClass} ${sizeClasses[size]}`}>
        {score}
        <span className="opacity-60 text-[0.8em]">/100</span>
      </span>
      {showLabel && (
        <span className="text-2xs uppercase tracking-wider font-semibold opacity-85">
          {label}
        </span>
      )}
    </div>
  )
}
