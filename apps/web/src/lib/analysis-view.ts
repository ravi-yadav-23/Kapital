// Pure helpers for the listing-gain analysis panel (dependency-free so they run under `node --test`).

export type AnalysisBadge = 'APPLY' | 'WATCH' | 'AVOID' | null
export type RequestState = 'cached' | 'queued' | 'already_queued'

export interface AnalysisSignal {
  code: string
  direction: 'positive' | 'negative' | 'neutral'
  reason: string
}

export interface Analysis {
  ipo_id: string
  /** ready = offer document analysed; market_only = scored from market data, document not analysed yet */
  state: 'ready' | 'market_only' | 'not_analysed'
  badge: AnalysisBadge
  score: number | null
  verdict: string | null
  confidence: 'high' | 'medium' | 'low' | 'none' | null
  signals: AnalysisSignal[]
  components: Record<string, { value: number; weight: number }>
  red_flags: { code: string; severity: string; reason: string }[]
  facts: Record<string, number | boolean>
  as_of: string | null
  queued: boolean
  documents_analysed: boolean
}

/** Response to "Run audit": the analysis fields plus what happened to the request. */
export type AuditResponse = Omit<Analysis, 'state'> & { state: RequestState }

/** Small corner badge. Colours are class names from the existing design tokens. */
export function badgeStyle(badge: AnalysisBadge | undefined): { label: string; className: string } | null {
  switch (badge) {
    case 'APPLY':
      return { label: 'Apply', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' }
    case 'WATCH':
      return { label: 'Watch', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
    case 'AVOID':
      return { label: 'Avoid', className: 'bg-red-500/15 text-red-300 border-red-500/40' }
    default:
      return null
  }
}

export function requestMessage(state: RequestState): string {
  switch (state) {
    case 'cached':
      return 'The latest analysis is already up to date, so nothing was queued and no daily request was used.'
    case 'queued':
      return 'Queued. It will be analysed in tonight’s nightly run (around 02:00 IST). Check back tomorrow morning.'
    case 'already_queued':
      return 'This IPO is already queued for tonight’s run. No extra request was used.'
  }
}

export function auditErrorMessage(status: number, detail?: string): string {
  if (status === 429) return 'Today’s audit limit for all visitors has been reached. Please try again tomorrow.'
  if (status === 503) return 'The API is unreachable right now. Please try again in a moment.'
  return detail || `Request failed (HTTP ${status}).`
}

const ORDER: Record<AnalysisSignal['direction'], number> = { negative: 0, positive: 1, neutral: 2 }

/** Risks first so they are never buried under good news. */
export function orderSignals(signals: AnalysisSignal[]): AnalysisSignal[] {
  return [...signals].sort((a, b) => ORDER[a.direction] - ORDER[b.direction])
}

/** One line saying what the score is based on. Null when documents were analysed (nothing to caveat). */
export function basisNote(analysis: Pick<Analysis, 'state' | 'score'> | null | undefined): string | null {
  if (!analysis || analysis.score === null || analysis.score === undefined) return null
  if (analysis.state === 'market_only') {
    return 'Based on market data only (grey-market premium and subscription). The company\u2019s offer document has not been analysed yet.'
  }
  return null
}

export function confidenceNote(confidence: Analysis['confidence'] | undefined): string | null {
  if (confidence === 'low') return 'Limited evidence so far: treat this verdict as tentative.'
  if (confidence === 'medium') return 'Moderate evidence: company documents are not fully analysed yet.'
  return null
}
