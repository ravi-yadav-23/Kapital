import {
  Ipo,
  FamilyAccount,
  Allotment,
  PnlSummary,
  FundSummary,
  AllocationPlan,
  IpoOrder,
  AiReport,
  AppSettings,
} from '../types'

// ── Clean Empty Stores (Zero Mock Data) ───────────────────────────────────────

export const MOCK_IPOS: Ipo[] = []

export const MOCK_ACCOUNTS: FamilyAccount[] = []

export const MOCK_ALLOTMENTS: Allotment[] = []

export const MOCK_FUND_SUMMARY: FundSummary = {
  total_family_balance: 0,
  total_available: 0,
  total_locked_asba: 0,
  utilization_percent: 0,
  accounts_active: 0,
  accounts_total: 0,
}

export const MOCK_PNL_SUMMARY: PnlSummary = {
  total_invested: 0,
  total_realized_pnl: 0,
  total_unrealized_pnl: 0,
  total_pnl: 0,
  overall_roi_percent: 0,
  total_applied_ipos: 0,
  total_allotments: 0,
  allotment_rate_percent: 0,
  total_sold: 0,
  total_holding: 0,
}

export const MOCK_ALLOCATION_PLAN: AllocationPlan = {
  generated_at: new Date().toISOString(),
  total_capital_deployed: 0,
  entries: [],
  skipped_ipos: [],
  warnings: [],
}

export const MOCK_ORDERS: IpoOrder[] = []

export const MOCK_REPORTS: AiReport[] = []

export const MOCK_APP_SETTINGS: AppSettings = {
  auto_apply_min_score: 80,
  watch_min_score: 60,
  avoid_below_score: 40,
  notifications: {
    score_alerts: true,
    allotment_alerts: true,
    listing_sell_alerts: true,
    fund_unlock_alerts: false,
  },
}
