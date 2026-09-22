// ── P&L / Fund Summary Types ──────────────────────────────────────────────────

export interface PnlSummary {
  // Overall
  total_invested:         number
  total_realized_pnl:     number
  total_unrealized_pnl:   number
  total_pnl:              number
  overall_roi_percent:    number

  // Breakdown
  total_applied_ipos:     number
  total_allotments:       number
  allotment_rate_percent: number
  total_sold:             number
  total_holding:          number

  // Best / worst
  best_ipo?:  { name: string; roi: number }
  worst_ipo?: { name: string; roi: number }
}

export interface PnlEntry {
  ipo_id:         string
  ipo_name:       string
  account_name:   string
  invested:       number
  realized_pnl:   number
  roi_percent:    number
  status:         'SOLD' | 'HOLDING' | 'NOT_ALLOTTED'
  sell_date?:     string
}

// ── Fund overview per account ─────────────────────────────────────────────────
export interface FundSummary {
  total_family_balance:    number
  total_available:         number
  total_locked_asba:       number
  utilization_percent:     number   // locked / total
  accounts_active:         number
  accounts_total:          number
}
