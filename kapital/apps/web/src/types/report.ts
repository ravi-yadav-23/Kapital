import { RedFlag, ScoreBreakdown, ScoreRecommendation } from './ipo'

export interface AiReport {
  id: string
  ipo_id: string
  ipo_name: string
  ipo_symbol: string
  score: number
  recommendation: ScoreRecommendation
  generated_at: string
  score_summary: string
  financial_quality: string
  gmp_sentiment: string
  red_flags: RedFlag[]
  score_breakdown: ScoreBreakdown
  final_reasoning: string
}
