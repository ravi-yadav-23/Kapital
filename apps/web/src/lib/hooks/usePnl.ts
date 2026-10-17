'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PnlEntry {
  ipo_symbol: string
  ipo_name: string
  account_name: string
  shares_sold: number
  issue_price: number
  exit_price: number
  invested_amount: number
  realized_amount: number
  net_pnl: number
  roi_percent: number
  exit_date: string | null
  exit_type: string
}

export interface PnlSummary {
  total_invested: number
  total_realized: number
  total_net_pnl: number
  overall_roi_percent: number
  total_trades: number
  wins: number
  losses: number
  win_rate_percent: number
  breakdown: PnlEntry[]
}

const EMPTY_SUMMARY: PnlSummary = {
  total_invested: 0,
  total_realized: 0,
  total_net_pnl: 0,
  overall_roi_percent: 0,
  total_trades: 0,
  wins: 0,
  losses: 0,
  win_rate_percent: 0,
  breakdown: [],
}

export function usePnl() {
  const [summary, setSummary] = useState<PnlSummary>(EMPTY_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const apiBase =
        process.env.API_URL?.replace(/\/$/, '') ||
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
        (typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000')
      const token = typeof window !== 'undefined' ? localStorage.getItem('kapitl_token') : null
      const res = await fetch(`${apiBase}/api/reports/pnl/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data: PnlSummary = await res.json()
      setSummary(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load P&L data')
      setSummary(EMPTY_SUMMARY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  return { summary, isLoading, error, refetch: fetchSummary }
}
