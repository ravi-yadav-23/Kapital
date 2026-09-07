import { IpoStatus, ScoreRecommendation } from '../types'

// ── Currency / Number Formatters ──────────────────────────────────────────────

/**
 * Format number as Indian Rupee (e.g. ₹15,000 or ₹1,50,000)
 */
export function formatINR(amount: number | undefined | null, includeDecimals = false): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals ? 2 : 0,
  }).format(amount)
}

/**
 * Short Indian currency formatter (e.g. ₹1.5L, ₹4,800Cr)
 */
export function formatCompactINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
  
  const absVal = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  
  if (absVal >= 10000000) {
    return `${sign}₹${(absVal / 10000000).toFixed(2)} Cr`
  }
  if (absVal >= 100000) {
    return `${sign}₹${(absVal / 100000).toFixed(2)} L`
  }
  return formatINR(amount, false)
}

/**
 * Format percentage (e.g. +22.5% or -5.0%)
 */
export function formatPercent(value: number | undefined | null, showSign = true): string {
  if (value === undefined || value === null || isNaN(value)) return '0.0%'
  const formatted = `${Math.abs(value).toFixed(1)}%`
  if (!showSign || value === 0) return formatted
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

/**
 * Format subscription multiple (e.g. 14.5x)
 */
export function formatSubscriptionMultiple(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0.0x'
  return `${value.toFixed(2)}x`
}

// ── Date Formatters ──────────────────────────────────────────────────────────

/**
 * Format date string to display readable date (e.g. "12 Aug 2026")
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

/** Date + time for order audit timestamps (e.g. "30 Aug 2026, 11:20 am") */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export function formatShortDate(dateString: string | undefined | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return dateString
  }
}

/**
 * Format days remaining until close / listing
 */
export function getDaysRemainingText(targetDate: string | undefined | null): string {
  if (!targetDate) return ''
  try {
    const target = new Date(targetDate).getTime()
    const now = new Date().getTime()
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'Passed'
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return `${diffDays} days left`
  } catch {
    return ''
  }
}

// ── Score & Status Style Helpers ─────────────────────────────────────────────

export function getScoreBadgeClass(score?: number): string {
  if (score === undefined || score === null) return 'bg-surface-elevated text-text-muted'
  if (score >= 80) return 'score-strong'
  if (score >= 60) return 'score-moderate'
  if (score >= 40) return 'score-watch'
  return 'score-avoid'
}

export function getScoreRecommendation(score?: number): ScoreRecommendation {
  if (score === undefined || score === null) return 'PENDING'
  if (score >= 80) return 'STRONG_APPLY'
  if (score >= 60) return 'MODERATE_APPLY'
  if (score >= 40) return 'WATCH'
  return 'AVOID'
}

export function getRecommendationLabel(rec?: ScoreRecommendation): string {
  switch (rec) {
    case 'STRONG_APPLY': return 'Strong Apply'
    case 'MODERATE_APPLY': return 'Moderate Apply'
    case 'WATCH': return 'Watch'
    case 'AVOID': return 'Avoid'
    default: return 'Pending'
  }
}

export function getStatusPillClass(status: IpoStatus): string {
  switch (status) {
    case 'open': return 'status-open'
    case 'upcoming': return 'status-upcoming'
    case 'closing_today': return 'status-closing'
    case 'closed': return 'status-closed'
    case 'allotted': return 'bg-accent-purple/15 text-accent-purple'
    case 'listed': return 'bg-accent-blue/15 text-accent-blue'
    default: return 'status-closed'
  }
}

export function getStatusLabel(status: IpoStatus): string {
  switch (status) {
    case 'open': return 'Open Now'
    case 'upcoming': return 'Upcoming'
    case 'closing_today': return 'Closing Today'
    case 'closed': return 'Closed'
    case 'allotted': return 'Allotted'
    case 'listed': return 'Listed'
    default: return status
  }
}
