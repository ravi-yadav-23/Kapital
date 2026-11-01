'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount } from '@/types'
import { MOCK_IPOS, MOCK_ACCOUNTS } from '@/lib/mock-data'
import { IpoBoard } from '@/components/ipo/IpoBoard'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { RefreshCw } from 'lucide-react'

export default function IposPage() {
  const [ipos, setIpos] = useState<Ipo[]>(MOCK_IPOS)
  const [accounts, setAccounts] = useState<FamilyAccount[]>(MOCK_ACCOUNTS)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [iposData, accountsData] = await Promise.all([
        apiClient.getIpos(),
        apiClient.getAccounts(),
      ])
      setIpos(iposData)
      setAccounts(accountsData)
    } catch (err) {
      console.error('Failed to load IPOs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cachedIpos = apiClient.getCachedIpos()
    if (cachedIpos && cachedIpos.length > 0) setIpos(cachedIpos)
    const cachedAccounts = apiClient.getCachedAccounts()
    if (cachedAccounts && cachedAccounts.length > 0) setAccounts(cachedAccounts)
    fetchData()
  }, [fetchData])

  useWebSocketEvent('IPOS_SYNCED', () => {
    fetchData()
  })

  const handleSyncMarket = async () => {
    setSyncing(true)
    try {
      await apiClient.syncIpos()
      await fetchData()
    } catch (err) {
      console.error('Failed to sync market IPOs:', err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page Header (Subtle, Informational) */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="text-lg font-medium text-ink">IPO Discovery & Scoring</h1>
            <p className="text-xs text-ink-2 mt-0.5">
              Live primary market feed scored across DRHP fundamentals and grey market premiums.
            </p>
          </div>

          <button
            onClick={handleSyncMarket}
            disabled={syncing}
            className="btn-secondary h-8 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-ink' : 'text-ink-3'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Market Feed'}</span>
          </button>
        </div>

        {/* Board Component */}
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton-bar h-10 w-full" />
            <div className="skeleton-bar h-64 w-full" />
          </div>
        ) : (
          <IpoBoard ipos={ipos} accounts={accounts} />
        )}
      </div>
    </DashboardLayout>
  )
}
