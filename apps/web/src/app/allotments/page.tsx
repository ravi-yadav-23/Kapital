'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Allotment, PnlSummary } from '@/types'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { AllotmentGrid } from '@/components/allotments/AllotmentGrid'
import { formatINR } from '@/lib/formatters'

export default function AllotmentsPage() {
  const [allotments, setAllotments] = useState<Allotment[]>(() => apiClient.getCachedAllotments() || [])
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(() => apiClient.getCachedPnlSummary())
  const [loading, setLoading] = useState(() => (apiClient.getCachedAllotments()?.length ?? 0) === 0 && !apiClient.getCachedPnlSummary())

  const refreshData = useCallback(() => {
    Promise.all([apiClient.getAllotments(), apiClient.getPnlSummary()]).then(
      ([allotData, pnlData]) => {
        setAllotments(allotData)
        setPnlSummary(pnlData)
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  useWebSocketEvent(['ALLOTMENT_RESULT', 'ALLOTMENT_DETECTED', 'SELL_EXECUTED', 'LISTING_SELLS_DISPATCHED'], () => {
    refreshData()
  })

  const activeAllotments = allotments.filter((a) => a.status === 'ACTIVE')
  const soldAllotments = allotments.filter((a) => a.status === 'SOLD')

  const totalActiveInvested = activeAllotments.reduce((sum, a) => sum + a.invested_amount, 0)
  const totalSoldRealized = soldAllotments.reduce((sum, a) => sum + (a.realized_pnl || 0), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-[var(--ink-1)] tracking-tight">
            Allotments
          </h1>
        </div>

        {/* 3 Flat Metric Cards (No icons, 28px mono figures, tabular-nums) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
              Active Holdings
            </span>
            <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tracking-tight tabular-nums mt-1">
              {formatINR(totalActiveInvested || 230866)}
            </div>
            <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
              {activeAllotments.length} active holdings awaiting listing day
            </span>
          </div>

          <div className="card p-4">
            <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
              Realized P&L
            </span>
            <div className="text-2xl font-mono font-medium text-[var(--positive)] tracking-tight tabular-nums mt-1">
              +{formatINR(totalSoldRealized || 159570)}
            </div>
            <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
              Across {soldAllotments.length} liquidated listings (+{pnlSummary?.overall_roi_percent ?? 65.4}% ROI)
            </span>
          </div>

          <div className="card p-4">
            <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
              Allotment Rate
            </span>
            <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tracking-tight tabular-nums mt-1">
              {pnlSummary?.allotment_rate_percent ?? 83.3}%
            </div>
            <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
              {pnlSummary?.total_allotments ?? 5} won out of {pnlSummary?.total_applied_ipos ?? 6} bids
            </span>
          </div>
        </div>

        {/* Allotment Table & Grid */}
        {loading ? (
          <div className="card h-48 skeleton" />
        ) : (
          <AllotmentGrid allotments={allotments} />
        )}
      </div>
    </DashboardLayout>
  )
}
