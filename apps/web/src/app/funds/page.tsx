'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { FamilyAccount, FundSummary, AllocationPlan } from '@/types'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { StatCard } from '@/components/shared/StatCard'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { FundLockTimeline } from '@/components/funds/FundLockTimeline'
import { AllocationTable } from '@/components/funds/AllocationTable'
import { AddAccountModal } from '@/components/accounts/AddAccountModal'
import { Wallet, ShieldCheck, UserCheck, Plus, Sparkles, Lock } from 'lucide-react'

export default function FundsPage() {
  const [accounts, setAccounts] = useState<FamilyAccount[]>(() => apiClient.getCachedAccounts() || [])
  const [fundSummary, setFundSummary] = useState<FundSummary | null>(() => apiClient.getCachedFundSummary())
  const [plan, setPlan] = useState<AllocationPlan | null>(null)
  const [locks, setLocks] = useState<any[]>([])
  const [loading, setLoading] = useState(() => !apiClient.getCachedFundSummary() && (apiClient.getCachedAccounts()?.length ?? 0) === 0)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null)
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false)

  const loadData = useCallback(() => {
    Promise.all([
      apiClient.getAccounts(),
      apiClient.getFundSummary(),
      apiClient.getAllocationPlan(),
      apiClient.getAsbaLocks(),
    ])
      .then(([accs, funds, p, lcks]) => {
        setAccounts(accs || [])
        setFundSummary(funds)
        setPlan(p)
        setLocks(lcks || [])
      })
      .catch((err) => {
        console.warn('Could not fetch all funds data from backend:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useWebSocketEvent([
    'ORDER_PLACED',
    'ORDER_CANCELLED',
    'ORDER_FILLED',
    'ALLOTMENT_RESULT',
    'ALLOTMENT_DETECTED',
    'SELL_EXECUTED',
    'LISTING_SELLS_DISPATCHED',
    'ASBA_LOCKS_SWEPT',
  ], () => {
    loadData()
  })

  const [errorToast, setErrorToast] = useState<string | null>(null)

  const handleRefreshPlan = async () => {
    setIsRefreshingPlan(true)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('kapitl_alloc_plan')
      }
      const freshPlan = await apiClient.getAllocationPlan(true)
      setPlan(freshPlan)
    } catch (err: any) {
      console.error('Failed to re-calculate allocation plan:', err)
      setErrorToast('Failed to optimize allocation plan.')
      setTimeout(() => setErrorToast(null), 5000)
    } finally {
      setIsRefreshingPlan(false)
    }
  }

  const handleSaveAccount = async (newAcc: Partial<FamilyAccount>) => {
    try {
      if (editingAccount) {
        const updated = await apiClient.updateAccount(editingAccount.id, {
          name: newAcc.name,
          relation: newAcc.relation,
          available_balance: newAcc.available_balance,
          preferred_category: newAcc.preferred_category,
          is_active: newAcc.is_active,
        })
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      } else {
        const created = await apiClient.createAccount({
          name: newAcc.name || 'New Member',
          relation: newAcc.relation || 'Self',
          angel_client_id: newAcc.angel_client_id || `ANGEL_${Date.now().toString().slice(-5)}`,
          total_balance: newAcc.total_balance || 0,
          available_balance: newAcc.available_balance || 0,
          preferred_category: newAcc.preferred_category || 'RETAIL',
        })
        setAccounts((prev) => [...prev, created])
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('kapitl_alloc_plan')
      }
      const [funds, p, lcks] = await Promise.all([
        apiClient.getFundSummary(),
        apiClient.getAllocationPlan(true),
        apiClient.getAsbaLocks(),
      ])
      setFundSummary(funds)
      setPlan(p)
      setLocks(lcks || [])
      setIsAddOpen(false)
      setEditingAccount(null)
    } catch (err: any) {
      console.error('Failed to save demat account:', err)
      setErrorToast(err.message || 'Failed to save demat account.')
      setTimeout(() => setErrorToast(null), 5000)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-28 skeleton" />
            ))}
          </div>
          <div className="card h-64 skeleton" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-accent-green" />
              <span>Family Fund Manager & Multi-Demat Allocation</span>
            </h1>
            <p className="page-subtitle">
              Dynamic multi-account balance distribution, ASBA fund lock recycling, and PuLP optimization
            </p>
          </div>

          <div className="flex items-center gap-3">
            {errorToast && (
              <div className="px-3 py-1.5 rounded-lg bg-accent-red/15 text-accent-red border border-accent-red/30 text-xs font-semibold animate-fade-in">
                {errorToast}
              </div>
            )}
            <button
              onClick={() => {
                setEditingAccount(null)
                setIsAddOpen(true)
              }}
              className="btn btn-primary btn-sm gap-1.5 shadow-md shadow-brand-from/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Demat Account</span>
            </button>
          </div>
        </div>

        {/* ── 1. Stats Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Family Corpus"
            value={<AmountDisplay amount={fundSummary?.total_family_balance || 0} />}
            subtitle={`Across ${accounts.length} Active Demats`}
            icon={<Wallet className="w-4 h-4 text-brand-from" />}
          />

          <StatCard
            title="Available Capital"
            value={<AmountDisplay amount={fundSummary?.total_available || 0} className="text-accent-green" />}
            subtitle={`${(100 - (fundSummary?.utilization_percent ?? 0)).toFixed(1)}% liquid funds ready to deploy`}
            icon={<UserCheck className="w-4 h-4 text-accent-green" />}
          />

          <StatCard
            title="ASBA Capital Blocked"
            value={<AmountDisplay amount={fundSummary?.total_locked_asba || 0} className="text-accent-amber" />}
            subtitle={`${fundSummary?.utilization_percent || 0}% active lock-in`}
            icon={<Lock className="w-4 h-4 text-accent-amber" />}
          />
        </div>

        {/* ── 2. Accounts Table ────────────────────────────────────────────── */}
        <AccountsTable
          accounts={accounts}
          onEditAccount={(acc) => {
            setEditingAccount(acc)
            setIsAddOpen(true)
          }}
        />

        {/* ── 3. ASBA Fund Lock Timeline ───────────────────────────────────── */}
        <FundLockTimeline locks={locks} />

        {/* ── 4. PuLP Mathematical Allocation Solver Plan ──────────────────── */}
        {plan && (
          <AllocationTable
            plan={plan}
            onRefreshPlan={handleRefreshPlan}
            isRefreshing={isRefreshingPlan}
          />
        )}

        {/* Add / Edit Account Modal */}
        <AddAccountModal
          isOpen={isAddOpen}
          initialAccount={editingAccount}
          onClose={() => {
            setIsAddOpen(false)
            setEditingAccount(null)
          }}
          onAddAccount={handleSaveAccount}
        />
      </div>
    </DashboardLayout>
  )
}
