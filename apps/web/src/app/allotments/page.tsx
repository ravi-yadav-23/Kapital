'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Allotment, PnlSummary } from '@/types'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { StatCard } from '@/components/shared/StatCard'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { AllotmentGrid } from '@/components/allotments/AllotmentGrid'
import { CheckCircle2, DollarSign, Clock, TrendingUp } from 'lucide-react'

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
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-accent-purple" />
              <span>Allotment Tracker & Pre-Listing Sell Engine</span>
            </h1>
            <p className="page-subtitle">
              Automated Angel One Demat allotment polling, active lot staging, and 09:00 AM listing execution
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Demat Holdings"
            value={<AmountDisplay amount={totalActiveInvested} />}
            subtitle={`${activeAllotments.length} Active Lot${activeAllotments.length === 1 ? '' : 's'} awaiting listing day`}
            icon={<Clock className="w-4 h-4 text-accent-purple" />}
            delta={
              activeAllotments.length > 0
                ? {
                    value: '+0.0% Expected Gain',
                    isPositive: true,
                  }
                : undefined
            }
          />

          <StatCard
            title="Total Realized Profits"
            value={<AmountDisplay amount={totalSoldRealized} className="text-accent-green" />}
            subtitle={`Across ${soldAllotments.length} liquidated IPO listings`}
            icon={<DollarSign className="w-4 h-4 text-accent-green" />}
            delta={
              soldAllotments.length > 0
                ? {
                    value: `+${pnlSummary?.overall_roi_percent ?? 0}% Avg ROI`,
                    isPositive: true,
                  }
                : undefined
            }
          />

          <StatCard
            title="Historical Allotment Rate"
            value={`${pnlSummary?.allotment_rate_percent ?? 0}%`}
            subtitle={`${pnlSummary?.total_allotments ?? 0} won out of ${pnlSummary?.total_applied_ipos ?? 0} bids`}
            icon={<TrendingUp className="w-4 h-4 text-brand-from" />}
          />
        </div>

        {/* Allotment Grid & Pre-Listing Staging */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-48 skeleton" />
            ))}
          </div>
        ) : (
          <AllotmentGrid allotments={allotments} />
        )}
      </div>
    </DashboardLayout>
  )
}