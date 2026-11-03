import { RedFlag, ScoreBreakdown, ScoreRecommendation } from './ipo'

export interface FinancialYearItem {
  year: string
  amount_cr: number
}

export interface FinancialMetrics {
  revenue_growth_yoy?: string
  revenue_history?: FinancialYearItem[]
  pat_growth_yoy?: string
  pat_history?: FinancialYearItem[]
  cfo_history?: FinancialYearItem[]
  cfo_to_pat_ratio?: number
  growth_demand_verdict?: string
}

export interface GatekeeperCheck {
  key: string
  name: string
  details: string
  status: 'PASS' | 'FAIL' | 'WARN' | string
  threshold: string
  impact: string
}

export interface AiReport {
  id: string
  ipo_id: string
  ipo_name: string
  ipo_symbol: string
  score?: number
  overall_score?: number
  recommendation: ScoreRecommendation
  generated_at?: string
  scored_at?: string
  score_summary?: string
  executive_summary?: string
  financial_quality?: string
  gmp_sentiment?: string
  strengths?: string[]
  risks?: string[]
  red_flags: RedFlag[]
  score_breakdown: ScoreBreakdown
  final_reasoning?: string
  financial_metrics?: FinancialMetrics
  gatekeepers?: GatekeeperCheck[]
  pe_ratio?: number
  peer_avg_pe?: number
  ofs_percentage?: number
  gmp_percent?: number
  estimated_listing_price?: number
  summary_source?: 'ai_generated' | 'template_fallback' | 'sector_fallback' | string
  is_audited?: boolean
}
