// ── Family Account Types ──────────────────────────────────────────────────────

export type AccountCategory = 'RETAIL' | 'SHNI' | 'BHNI'

export interface FamilyAccount {
  id:            string
  name:          string                 // e.g. "Ravi", "Mom", "Dad"
  relation?:     string                 // e.g. "Self", "Mother", "Father"

  // Angel One credentials (api_key, mpin, totp_secret stored encrypted in DB)
  angel_client_id: string
  is_active:     boolean

  // Balances (fetched from Angel One or manually updated)
  total_balance:     number             // total demat account value
  available_balance: number             // total - ASBA locked
  locked_balance:    number             // ASBA blocked for current IPOs

  // Preferences
  preferred_category: AccountCategory   // default category for this account
  max_single_ipo_pct: number            // max % of balance in one IPO (default 80)

  // Stats
  total_applied_ipos:  number
  total_allotments:    number
  allotment_rate:      number           // %
  total_realized_pnl:  number

  // Timestamps
  last_synced_at?: string
  created_at:      string
}

// ── Lightweight version for lists/tables ──────────────────────────────────────
export interface AccountCard {
  id:               string
  name:             string
  relation?:        string
  angel_client_id:  string
  is_active:        boolean
  available_balance: number
  locked_balance:    number
  total_balance:     number
  preferred_category: AccountCategory
  allotment_rate:    number
  total_realized_pnl: number
}

// ── Fund lock record (ASBA) ───────────────────────────────────────────────────
export interface FundLock {
  id:                   string
  account_id:           string
  ipo_id:               string
  ipo_name:             string
  amount_blocked:       number
  block_date:           string           // when order was placed
  expected_release_date: string          // refund_date from IPO schedule
  is_released:          boolean
}

// ── Allocation plan (output of PuLP optimizer) ────────────────────────────────
export interface AllocationEntry {
  account_id:    string
  account_name:  string
  ipo_id:        string
  ipo_name:      string
  category:      AccountCategory | 'sHNI' | 'bHNI' | string
  lots:          number
  amount:        number
  expected_return_pct: number            // optimizer's expected ROI estimate
  confidence?:   'HIGH' | 'MEDIUM' | 'LOW'
  reason?:       string                  // solver rationale with reservation note
}

/**
 * An upcoming high-score IPO whose open date falls inside the ASBA lock window
 * of a currently-active IPO bid — meaning your money could still be blocked.
 */
export interface UpcomingConflict {
  upcoming_ipo_name: string
  upcoming_score:    number
  upcoming_gmp:      number
  open_date:         string | null
  conflicts: Array<{
    blocking_ipo:       string   // the currently-open IPO locking your funds
    asba_free_date:     string   // when ASBA funds are expected back
    upcoming_open_date: string   // when the upcoming IPO opens for bidding
  }>
}

export interface AllocationPlan {
  plan_id?:     string
  status?:      string
  generated_at: string
  total_capital_deployed:   number
  entries:                  AllocationEntry[]
  skipped_ipos:             Array<{ ipo_id: string; reason: string }>
  warnings:                 string[]
  is_demo?:                 boolean
  asba_lock_overlaps_detected?: number
  upcoming_conflicts?:      UpcomingConflict[]
}
