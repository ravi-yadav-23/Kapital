import { RedFlag, ScoreBreakdown, ScoreRecommendation } from './ipo'

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
  gmp_percent?: number
  estimated_listing_price?: number
  summary_source?: 'ai_generated' | 'template_fallback' | 'sector_fallback' | string
  is_audited?: boolean
}
