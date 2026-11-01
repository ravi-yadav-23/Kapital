'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { FamilyAccount, FundSummary, AllocationPlan } from '@/types'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { FundLockTimeline } from '@/components/funds/FundLockTimeline'
import { AllocationTable } from '@/components/funds/AllocationTable'
import { AddAccountModal } from '@/components/accounts/AddAccountModal'
import { formatINR } from '@/lib/formatters'
import { Plus, RefreshCw } from 'lucide-react'

export default function FundsPage() {
  const [accounts, setAccounts] = useState<FamilyAccount[]>(() => apiClient.getCachedAccounts() || [])
  const [fundSummary, setFundSummary] = useState<FundSummary | null>(() => apiClient.getCachedFundSummary())
  const [plan, setPlan] = useState<AllocationPlan | null>(null)
  const [locks, setLocks] = useState<any[]>([])
  const [loading, setLoading] = useState(() => !apiClient.getCachedFundSummary() && (apiClient.getCachedAccounts()?.length ?? 0) === 0)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null)
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)

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

  const totalBalance = fundSummary?.total_family_balance || 1400000
  const availableBal = fundSummary?.total_available || 820000
  const lockedBal = fundSummary?.total_locked_asba || 580000
  const lockedPercent = fundSummary?.utilization_percent || (totalBalance > 0 ? Math.round((lockedBal / totalBalance) * 100) : 0)
  const availablePercent = 100 - lockedPercent

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-[var(--ink-1)] tracking-tight">
              Fund Manager
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {errorToast && (
              <div className="px-3 py-1 rounded text-2xs font-mono text-[var(--negative)] bg-[var(--bg-subtle)] border border-[var(--negative)]">
                {errorToast}
              </div>
            )}
            <button
              onClick={() => {
                setEditingAccount(null)
                setIsAddOpen(true)
              }}
              className="btn btn-secondary btn-sm gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
            <button
              onClick={handleRefreshPlan}
              disabled={isRefreshingPlan}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPlan ? 'animate-spin' : ''}`} />
              <span>{isRefreshingPlan ? 'Optimizing...' : 'Run Optimizer'}</span>
            </button>
          </div>
        </div>

        {/* ── 1. Stats Row (Flat, no icons, 28px mono figures) ───────────────── */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4">
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
                Total Corpus
              </span>
              <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tracking-tight tabular-nums mt-1">
                {formatINR(totalBalance)}
              </div>
              <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
                Across {accounts.length} demats
              </span>
            </div>

            <div className="card p-4">
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
                Available Capital
              </span>
              <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tracking-tight tabular-nums mt-1">
                {formatINR(availableBal)}
              </div>
              <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
                {availablePercent.toFixed(1)}% liquid funds ready to deploy
              </span>
            </div>

            <div className="card p-4">
              <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block tracking-wider">
                In ASBA (Blocked)
              </span>
              <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tracking-tight tabular-nums mt-1">
                {formatINR(lockedBal)}
              </div>
              <span className="text-2xs text-[var(--ink-3)] mt-1 block font-mono">
                {lockedPercent}% active lock-in · {locks.length} locks active
              </span>
            </div>
          </div>

          {/* Thin 4px utilization bar */}
          <div className="h-1 w-full bg-[var(--bg-subtle)] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[var(--ink-1)]"
              style={{ width: `${availablePercent}%` }}
              title={`Available: ${availablePercent.toFixed(1)}%`}
            />
            <div
              className="h-full bg-[var(--ink-3)]"
              style={{ width: `${lockedPercent}%` }}
              title={`ASBA Locked: ${lockedPercent}%`}
            />
          </div>
        </div>

        {/* ── 2. PuLP Mathematical Allocation Solver Plan (Hero) ───────────── */}
        {plan && (
          <AllocationTable
            plan={plan}
            onRefreshPlan={handleRefreshPlan}
            isRefreshing={isRefreshingPlan}
          />
        )}

        {/* ── 3. Accounts Table ────────────────────────────────────────────── */}
        <AccountsTable
          accounts={accounts}
          onEditAccount={(acc) => {
            setEditingAccount(acc)
            setIsAddOpen(true)
          }}
        />

        {/* ── 4. ASBA Fund Lock Timeline / Table ───────────────────────────── */}
        <FundLockTimeline locks={locks} />

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
