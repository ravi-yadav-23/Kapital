// ── IPO Types ── derived from ipoalerts.in API response + our own enrichment ──

export type IpoStatus = 'upcoming' | 'open' | 'closing_today' | 'closed' | 'allotted' | 'listed'
export type IpoType   = 'EQ' | 'SME' | 'REIT' | 'InvIT'
export type IpoSource = 'nse' | 'bse'

export type ScoreRecommendation = 'STRONG_APPLY' | 'MODERATE_APPLY' | 'WATCH' | 'AVOID' | 'PENDING'

export interface IpoScheduleEvent {
  event: string   // e.g. "Issue open date", "Allotment finalization"
  date:  string   // ISO date string
}

export interface RedFlag {
  flag?: string
  title?: string
  description?: string
  detail?: string
  type?: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | string
  penalty?: number
  penalty_points?: number
}

export interface ScoreBreakdown {
  financial_quality: number
  valuation_safety?: number
  gmp_strength?: number
  gmp_signal?: number
  subscription_momentum?: number
  subscription_hype?: number
  industry_tailwinds?: number
  industry_trend?: number
  promoter_integrity?: number
  allotment_probability?: number
  lock_in_conflict?: number
  total?: number
}

// ── Core IPO model (matches DB + API response combined) ──────────────────────
export interface Ipo {
  // Identity
  id:          string
  external_id: string                // ipoalerts.in id
  source:      IpoSource
  slug:        string
  name:        string
  symbol:      string
  type:        IpoType
  status:      IpoStatus
  logo_url?:   string

  // Price / lot info
  price_band_min:  number
  price_band_max:  number
  lot_size:        number            // minQty from API
  min_investment:  number            // lot_size × price_band_max
  issue_size:      string            // e.g. "4800cr"

  // Dates
  issue_open_date:   string          // ISO date
  issue_close_date:  string
  allotment_date?:   string
  refund_date?:      string
  listing_date?:     string
  schedule:          IpoScheduleEvent[]

  // Links
  ipo_info_url?:   string
  prospectus_url?: string
  bse_info_url?:   string
  nse_info_url?:   string

  // Qualitative data (from ipoalerts + Claude)
  about?:      string
  strengths:   string[]
  risks:       string[]

  // AI scoring (populated after scoring pipeline runs)
  score?:              number               // 0–100
  score_breakdown?:    ScoreBreakdown
  recommendation?:     ScoreRecommendation
  red_flags:           RedFlag[]
  scored_at?:          string               // ISO datetime

  // Live market data (from scraper)
  gmp_percent?:           number            // Grey market premium %
  subscription_retail?:   number            // e.g. 2.5 = 2.5× subscribed
  subscription_shni?:     number
  subscription_bhni?:     number
  subscription_total?:    number
  subscription_updated?:  string            // ISO datetime

  // Metadata
  created_at: string
  updated_at: string
}

// ── Lightweight card variant for list views ───────────────────────────────────
export interface IpoCard {
  id:             string
  name:           string
  symbol:         string
  status:         IpoStatus
  logo_url?:      string
  price_band_min: number
  price_band_max: number
  lot_size:       number
  min_investment: number
  issue_open_date:  string
  issue_close_date: string
  listing_date?:    string
  issue_size:     string
  score?:         number
  recommendation?: ScoreRecommendation
  gmp_percent?:   number
  subscription_total?: number
}

// ── API response shape from ipoalerts.in ─────────────────────────────────────
export interface IpoAlertsResponse {
  meta: {
    count:       number
    countOnPage: number
    totalPages:  number
    page:        number
    limit:       number
    info?:       string
  }
  ipos: IpoAlertsRaw[]
}

export interface IpoAlertsRaw {
  id:                string
  source:            IpoSource
  status:            string
  slug:              string
  name:              string
  symbol:            string
  type:              string
  startDate:         string
  endDate:           string
  listingDate?:      string
  priceRange:        string   // "95-100" — must be parsed
  minQty?:           number
  issueSize?:        string
  logo?:             string
  infoUrl?:          string
  bseInfoUrl?:       string
  nseInfoUrl?:       string
  prospectusUrl?:    string
  about?:            string
  strengths:         string[]
  risks:             string[]
  mediaCoverageLinks: string[]
  schedule:          IpoScheduleEvent[]
}

// ── Utility: parse ipoalerts raw → our IpoCard ───────────────────────────────
export function parseIpoAlertsRaw(raw: IpoAlertsRaw): Partial<Ipo> {
  const [minStr, maxStr] = raw.priceRange.split('-')
  const min = parseFloat(minStr) || 0
  const max = parseFloat(maxStr) || min

  const findScheduleDate = (keyword: string): string | undefined =>
    raw.schedule.find(e => e.event.toLowerCase().includes(keyword))?.date

  return {
    external_id:      raw.id,
    source:           raw.source,
    slug:             raw.slug,
    name:             raw.name,
    symbol:           raw.symbol,
    type:             raw.type as IpoType,
    status:           raw.status as IpoStatus,
    logo_url:         raw.logo,
    price_band_min:   min,
    price_band_max:   max,
    lot_size:         raw.minQty || 1,
    min_investment:   (raw.minQty || 1) * max,
    issue_size:       raw.issueSize || '',
    issue_open_date:  raw.startDate,
    issue_close_date: raw.endDate,
    listing_date:     raw.listingDate || findScheduleDate('listing'),
    allotment_date:   findScheduleDate('allotment'),
    refund_date:      findScheduleDate('refund'),
    schedule:         raw.schedule,
    ipo_info_url:     raw.infoUrl,
    bse_info_url:     raw.bseInfoUrl,
    nse_info_url:     raw.nseInfoUrl,
    prospectus_url:   raw.prospectusUrl,
    about:            raw.about,
    strengths:        raw.strengths || [],
    risks:            raw.risks || [],
    red_flags:        [],
  }
}
