'use client'

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount } from '@/types'
import { IpoBoard } from '@/components/ipo/IpoBoard'
import { TrendingUp, Layers, Flame, Sparkles } from 'lucide-react'

export default function IposPage() {
  const [ipos, setIpos] = useState<Ipo[]>([])
  const [accounts, setAccounts] = useState<FamilyAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiClient.getIpos(), apiClient.getAccounts()]).then(
      ([iposData, accountsData]) => {
        setIpos(iposData)
        setAccounts(accountsData)
        setLoading(false)
      }
    )
  }, [])

  const openCount = ipos.filter((i) => i.status === 'open').length
  const closingCount = ipos.filter((i) => i.status === 'closing_today').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-brand-from" />
              <span>IPO Discovery & Scoring Pipeline</span>
            </h1>
            <p className="page-subtitle">
              Live market feed with Claude DRHP analysis, Gemini grey market signals, and instant SmartAPI staging
            </p>
          </div>

          {/* Mini pipeline status chips */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-status-open text-status-open-fg border border-accent-green/20 text-xs font-mono font-bold">
              <span className="dot-pulse" />
              <span>{openCount} Open</span>
            </div>
            {closingCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-status-closing text-status-closing-fg border border-accent-amber/20 text-xs font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-ping" />
                <span>{closingCount} Closing Today</span>
              </div>
            )}
          </div>
        </div>

        {/* Board Component */}
        {loading ? (
          <div className="space-y-4">
            <div className="card h-28 skeleton" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-64 skeleton" />
              ))}
            </div>
          </div>
        ) : (
          <IpoBoard ipos={ipos} accounts={accounts} showFilters={true} />
        )}
      </div>
    </DashboardLayout>
  )
}
