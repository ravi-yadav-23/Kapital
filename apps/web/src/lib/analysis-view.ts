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
  /**
   * ready = the offer document was read; summary_only = no readable document, company facts from Groww's financials
   * summary; market_only = scored from market data only; not_analysed = nothing to score from
   */
  state: 'ready' | 'summary_only' | 'web_only' | 'market_only' | 'not_analysed'
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
  facts_basis?: 'offer_document' | 'groww_summary' | 'web_search' | null
  sources?: { key: string; url: string; quote: string }[]
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
  if (analysis.state === 'web_only') {
    return 'No offer document could be read, so a few company figures were found by web search and checked against the pages they came from (sources below). This is the least complete basis: the score is capped and only a few facts are known.'
  }
  if (analysis.state === 'summary_only') {
    return 'The offer document could not be read, so company figures come from Groww\u2019s summary (revenue and profit for the last two years). Debt, cash flow, promoter holding and litigation are not checked, and the score is capped.'
  }
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

/** Labels for the engine's score components, in display order. */
export const COMPONENT_LABELS: [key: string, label: string][] = [
  ['company', 'Company quality (offer document)'],
  ['demand', 'Demand (subscription)'],
  ['gmp', 'Grey-market premium'],
  ['float', 'Issue size'],
  ['market', 'Market mood'],
]

/** Components the engine used, with their share of the weight as a whole percent. Unknown inputs are omitted. */
export function componentRows(components: Analysis['components'] | null | undefined): { key: string; label: string; value: number; weightPct: number }[] {
  if (!components) return []
  return COMPONENT_LABELS.filter(([k]) => components[k]).map(([k, label]) => ({
    key: k,
    label,
    value: Math.round(components[k].value),
    weightPct: Math.round(components[k].weight * 100),
  }))
}

const FACT_FORMAT: [key: string, label: string, fmt: (v: number) => string][] = [
  ['net_profit_cr', 'Net profit', (v) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr`],
  ['revenue_growth_pct', 'Revenue growth', (v) => `${v.toFixed(1)}%`],
  ['net_margin_pct', 'Net margin', (v) => `${v.toFixed(1)}%`],
  ['operating_cash_flow_cr', 'Operating cash flow', (v) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr`],
  ['debt_to_equity', 'Debt-to-equity', (v) => v.toFixed(2)],
  ['pe_ratio', 'P/E', (v) => v.toFixed(1)],
  ['sector_pe', 'Sector P/E', (v) => v.toFixed(1)],
  ['promoter_holding_post_pct', 'Promoter holding after issue', (v) => `${v.toFixed(1)}%`],
  ['ofs_share_pct', 'Offer for sale share', (v) => `${v.toFixed(0)}%`],
]
const BOOL_FACTS: [key: string, label: string][] = [
  ['material_litigation', 'Material litigation disclosed'],
  ['regulatory_action_against_promoter', 'Regulatory action against promoter / company'],
  ['auditor_qualification', 'Auditor qualification'],
  ['is_lender', 'Lender (bank / NBFC / housing finance)'],
]

/** The extracted company facts as label / value rows. Only facts that were actually found are listed. */
export function factRows(facts: Analysis['facts'] | null | undefined): { label: string; value: string }[] {
  if (!facts) return []
  const rows: { label: string; value: string }[] = []
  for (const [k, label, fmt] of FACT_FORMAT) {
    const v = facts[k]
    if (typeof v === 'number' && Number.isFinite(v)) rows.push({ label, value: fmt(v) })
  }
  for (const [k, label] of BOOL_FACTS) {
    if (typeof facts[k] === 'boolean') rows.push({ label, value: facts[k] ? 'Yes' : 'No' })
  }
  return rows
}

export function basisLabel(analysis: Pick<Analysis, 'state'> | null | undefined): string {
  switch (analysis?.state) {
    case 'ready': return 'Offer document analysed'
    case 'summary_only': return 'Company summary only'
    case 'web_only': return 'Web search only'
    case 'market_only': return 'Market data only'
    default: return 'Not analysed yet'
  }
}
