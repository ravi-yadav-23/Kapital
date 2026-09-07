export interface NotificationPrefs {
  score_alerts: boolean
  allotment_alerts: boolean
  listing_sell_alerts: boolean
  fund_unlock_alerts: boolean
}

export interface AppSettings {
  auto_apply_min_score: number
  watch_min_score: number
  avoid_below_score: number
  notifications: NotificationPrefs
}
