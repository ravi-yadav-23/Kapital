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
 * Compact Indian currency formatter (e.g. ₹2L, ₹10.3L, ₹1.4Cr) — never 'k' or 'M'
 */
export function formatCompactINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
  
  const absVal = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  
  if (absVal >= 10000000) {
    const cr = (absVal / 10000000).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')
    return `${sign}₹${cr}Cr`
  }
  if (absVal >= 100000) {
    const l = (absVal / 100000).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')
    return `${sign}₹${l}L`
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
  return `${value.toFixed(1)}x`
}

// ── Date Formatters ──────────────────────────────────────────────────────────

/**
 * Returns current date in Indian Standard Time (Asia/Kolkata) as YYYY-MM-DD
 */
export function getTodayIST(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * Canonical single-source computation of IPO status in IST.
 * Matches backend `compute_ipo_status`:
 * - If missing dates -> 'upcoming'
 * - If today < open_date -> 'upcoming'
 * - If open_date <= today < close_date -> 'open'
 * - If today == close_date -> 'closing_today'
 * - If today > close_date -> 'closed'
 */
export function computeIpoStatus(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
  todayStr?: string
): 'upcoming' | 'open' | 'closing_today' | 'closed' {
  if (!openDate || !closeDate) return 'upcoming'

  const today = todayStr || getTodayIST()

  const parseDateOnly = (d: string): string => {
    if (d.includes('T')) return d.split('T')[0]
    if (d.includes(' ')) return d.split(' ')[0]
    return d.trim()
  }

  const open = parseDateOnly(openDate)
  const close = parseDateOnly(closeDate)

  if (today < open) return 'upcoming'
  if (today > close) return 'closed'
  if (today === close) return 'closing_today'
  return 'open'
}

/**
 * Derives a 28px avatar tile's initials and deterministic muted color palette from company name.
 */
export function getCompanyAvatarProps(name: string): { initials: string; bg: string; text: string } {
  const clean = (name || '').replace(/Limited|Ltd\.?|India|Private|Pvt\.?/gi, '').trim()
  const words = clean.split(/\s+/).filter(Boolean)
  let initials = 'IP'
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase()
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase()
  } else if (words.length === 1) {
    initials = words[0][0].toUpperCase()
  }

  const PALETTES = [
    { bg: 'bg-[#1e2530] border-[#2b394d]', text: 'text-[#85b8ff]' }, // slate blue
    { bg: 'bg-[#251f2d] border-[#3d2e4f]', text: 'text-[#c6a0f6]' }, // muted lavender
    { bg: 'bg-[#1b2720] border-[#284131]', text: 'text-[#7ee787]' }, // soft sage
    { bg: 'bg-[#2b251a] border-[#443821]', text: 'text-[#eac57e]' }, // warm ochre
    { bg: 'bg-[#2b1e24] border-[#442735]', text: 'text-[#f48fb1]' }, // dusty rose
    { bg: 'bg-[#19272b] border-[#233f47]', text: 'text-[#76e4f7]' }, // muted teal
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % PALETTES.length
  return { initials, ...PALETTES[idx] }
}

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

/** Date + time for order audit timestamps (e.g. "30 Aug 2026, 1:20 pm") */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const timePart = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${datePart}, ${timePart.toLowerCase()}`
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
 * Relative plus absolute date (e.g. "Tomorrow · 19 Oct" or "In 3 days · 21 Oct")
 */
export function formatRelativeDate(targetDate: string | undefined | null): string {
  if (!targetDate) return '—'
  try {
    const target = new Date(targetDate)
    if (isNaN(target.getTime())) return targetDate
    const now = new Date()
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const absDate = target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    
    if (diffDays < 0) return `Closed · ${absDate}`
    if (diffDays === 0) return `Today · ${absDate}`
    if (diffDays === 1) return `Tomorrow · ${absDate}`
    return `In ${diffDays} days · ${absDate}`
  } catch {
    return targetDate
  }
}

// ── Score & Status Style Helpers (v2 Status System) ─────────────────────────

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

export function getScoreBadgeClass(score?: number): string {
  if (score === undefined || score === null) return 'text-ink-3'
  return 'text-ink'
}

export function getScoreBarColor(score?: number): string {
  if (score === undefined || score === null) return 'bg-[#9ca3af]'
  if (score >= 70) return 'bg-[#22c55e]' // Strong Apply -> green
  if (score >= 55) return 'bg-[#6ea8fe]' // Moderate Apply -> blue
  if (score >= 40) return 'bg-[#9ca3af]' // Watch -> grey
  return 'bg-[#ef4444]' // Avoid -> red
}

export function getStatusPillClass(status: IpoStatus | string): string {
  const s = (status || '').toLowerCase()
  if (['open', 'allotted', 'confirmed', 'sold'].includes(s)) {
    return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-normal border bg-[rgba(34,197,94,0.14)] text-emerald-400 border-[rgba(34,197,94,0.25)]'
  }
  if (['upcoming'].includes(s)) {
    return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-normal border bg-[rgba(110,168,254,0.14)] text-[#6ea8fe] border-[rgba(110,168,254,0.25)]'
  }
  if (['cancelled', 'rejected', 'avoid'].includes(s)) {
    return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-normal border bg-[rgba(239,68,68,0.14)] text-rose-400 border-[rgba(239,68,68,0.25)]'
  }
  // closed, closing_today, applied, pending, watch
  return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-normal border bg-[rgba(156,163,175,0.14)] text-ink-2 border-[rgba(156,163,175,0.25)]'
}

export function getScoreRecommendation(score?: number): ScoreRecommendation {
  if (score === undefined || score === null) return 'PENDING'
  if (score >= 70) return 'STRONG_APPLY'
  if (score >= 55) return 'MODERATE_APPLY'
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

export function getStatusDotClass(status: string): string {
  const s = (status || '').toLowerCase()
  if (['open', 'allotted', 'confirmed', 'sold'].includes(s)) {
    return 'w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0'
  }
  if (['cancelled', 'rejected', 'avoid'].includes(s)) {
    return 'w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0'
  }
  if (['upcoming'].includes(s)) {
    return 'w-1.5 h-1.5 rounded-full bg-[#6ea8fe] flex-shrink-0'
  }
  if (['closing_today'].includes(s)) {
    return 'w-1.5 h-1.5 rounded-full bg-[#f59e0b] flex-shrink-0'
  }
  return 'w-1.5 h-1.5 rounded-full bg-[#9ca3af] flex-shrink-0'
}

export function getStatusLabel(status: string): string {
  const s = status.toLowerCase()
  switch (s) {
    case 'open': return 'Open'
    case 'upcoming': return 'Upcoming'
    case 'closing_today': return 'Closing Today'
    case 'closed': return 'Closed'
    case 'allotted': return 'Allotted'
    case 'sold': return 'Sold'
    case 'confirmed': return 'Confirmed'
    case 'applied': return 'Applied'
    case 'cancelled': return 'Cancelled'
    case 'rejected': return 'Rejected'
    default: return status
  }
}
