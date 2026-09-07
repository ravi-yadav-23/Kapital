// ── Allotment Types ───────────────────────────────────────────────────────────

export type AllotmentStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SOLD'

export interface Allotment {
  id:            string
  ipo_id:        string
  ipo_name:      string
  ipo_symbol:    string
  account_id:    string
  account_name:  string

  // Allotment result
  status:         AllotmentStatus
  allotted_shares: number              // 0 if not allotted
  issue_price:    number
  invested_amount: number              // allotted_shares × issue_price

  // Sale result (populated after sell)
  sold_shares?:   number
  sell_price?:    number
  sell_date?:     string
  sell_order_id?: string

  // P&L
  realized_pnl?:   number
  roi_percent?:     number

  // Listing
  listing_date?:     string
  listing_price?:    number            // actual listing price (after market opens)
  current_price?:    number            // live price if still holding

  // Metadata
  allotment_checked_at?: string
  created_at:  string
  updated_at:  string
}

// ── Lightweight for grid views ────────────────────────────────────────────────
export interface AllotmentCard {
  id:             string
  ipo_name:       string
  ipo_symbol:     string
  account_name:   string
  status:         AllotmentStatus
  allotted_shares: number
  issue_price:    number
  invested_amount: number
  sell_price?:    number
  realized_pnl?:  number
  roi_percent?:   number
  listing_date?:  string
}
