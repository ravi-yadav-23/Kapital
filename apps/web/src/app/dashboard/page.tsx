'use client'

import React, { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Ipo, FundSummary, PnlSummary, AllocationPlan, FamilyAccount } from '@/types'
import { StatCard } from '@/components/shared/StatCard'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { IpoBoard } from '@/components/ipo/IpoBoard'
import { AllocationSummary } from '@/components/dashboard/AllocationSummary'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Wallet, CheckCircle2, TrendingUp, Sparkles, Layers, Zap, Clock, DollarSign, ArrowUpRight } from 'lucide-react'

export default function DashboardPage() {
  const [ipos, setIpos] = useState<Ipo[]>([])
  const [accounts, setAccounts] = useState<FamilyAccount[]>([])
  const [fundSummary, setFundSummary] = useState<FundSummary | null>(null)
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(null)
  const [plan, setPlan] = useState<AllocationPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState(false)

  const handleCalculatePlan = async (force = false) => {
    setLoadingPlan(true)
    try {
      const planData = await apiClient.getAllocationPlan(force)
      setPlan(planData)
    } catch (err) {
      console.error('Error calculating allocation plan:', err)
    } finally {
      setLoadingPlan(false)
    }
  }

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [iposData, fundsData, pnlData, accountsData] = await Promise.all([
          apiClient.getIpos(),
          apiClient.getFundSummary(),
          apiClient.getPnlSummary(),
          apiClient.getAccounts(),
        ])
        setIpos(iposData)
        setFundSummary(fundsData)
        setPnlSummary(pnlData)
        setAccounts(accountsData || [])
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }

      // Check for cached plan or fetch without blocking page render
      try {
        const planData = await apiClient.getAllocationPlan(false)
        setPlan(planData)
      } catch (err) {
        console.warn('Deferred allocation plan load:', err)
      }
    }
    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-28 skeleton" />
          ))}
        </div>
        <div className="card h-64 skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card h-64 skeleton" />
          <div className="card h-64 skeleton" />
        </div>
      </div>
    )
  }

  // ── Quick Stats Bar ──────────────────────────────────────────────
  const QuickStatsBar = () => {
    const stats = [
      {
        label: 'Open IPOs',
        value: ipos.filter(i => i.status === 'open').length,
        icon: <Zap className="w-3.5 h-3.5 text-accent-green" />,
        color: 'text-accent-green',
      },
      {
        label: 'Closing Today',
        value: ipos.filter(i => i.status === 'closing_today').length,
        icon: <Clock className="w-3.5 h-3.5 text-accent-amber" />,
        color: 'text-accent-amber',
      },
      {
        label: 'Upcoming',
        value: ipos.filter(i => i.status === 'upcoming').length,
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-accent-blue" />,
        color: 'text-accent-blue',
      },
      {
        label: 'Allotted',
        value: pnlSummary?.total_allotments || 0,
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-accent-purple" />,
        color: 'text-accent-purple',
      },
    ]

    return (
      <div className="flex flex-wrap items-center gap-4 p-3 bg-surface-elevated/50 rounded-xl border border-border-subtle">
        {stats.map((stat, index) => (
          <React.Fragment key={stat.label}>
            <div className="flex items-center gap-2">
              {stat.icon}
              <span className="text-2xs text-text-muted">{stat.label}</span>
              <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            {index < stats.length - 1 && (
              <div className="w-px h-6 bg-border-subtle" />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Welcome Section ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <span>Welcome back 👋</span>
            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-brand-from/15 text-brand-from border border-brand-from/30">
              V1 LIVE
            </span>
          </h1>
          <p className="text-sm text-text-muted">
            Autonomous IPO scoring, dynamic family allocation, and allotment tracking
          </p>
        </div>
        <QuickStatsBar />
      </div>

      {/* ── 1. Stats Row (4 Cards) ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Family Corpus"
          value={<AmountDisplay amount={fundSummary?.total_family_balance || 0} />}
          subtitle={`Across ${fundSummary?.accounts_total ?? 0} family accounts`}
          icon={<Layers className="w-4 h-4 text-brand-from" />}
        />

        <StatCard
          title="Available to Deploy"
          value={<AmountDisplay amount={fundSummary?.total_available || 0} />}
          subtitle={`${(100 - (fundSummary?.utilization_percent ?? 0)).toFixed(1)}% liquid capital`}
          icon={<Wallet className="w-4 h-4 text-accent-green" />}
          delta={
            (fundSummary?.total_locked_asba ?? 0) > 0
              ? {
                  value: `₹${((fundSummary?.total_locked_asba ?? 0) / 1000).toFixed(0)}k ASBA locked`,
                  isPositive: true,
                }
              : undefined
          }
        />

        <StatCard
          title="Active Allotments"
          value={
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{pnlSummary?.total_holding ?? 0}</span>
              <span className="text-xs text-text-muted font-normal">Active Lots</span>
            </div>
          }
          subtitle={`${pnlSummary?.total_allotments || 0} total allotments`}
          icon={<CheckCircle2 className="w-4 h-4 text-accent-purple" />}
          delta={
            (pnlSummary?.total_holding ?? 0) > 0
              ? {
                  value: '+0.0% Exp. Gain',
                  isPositive: true,
                }
              : undefined
          }
        />

        <StatCard
          title="Total Realized P&L"
          value={<AmountDisplay amount={pnlSummary?.total_realized_pnl || 0} className="text-accent-green" />}
          subtitle={`${pnlSummary?.allotment_rate_percent || 0}% overall hit rate`}
          icon={<TrendingUp className="w-4 h-4 text-accent-green" />}
          delta={
            (pnlSummary?.total_realized_pnl ?? 0) > 0
              ? {
                  value: `+${pnlSummary?.overall_roi_percent || 0}% ROI`,
                  isPositive: true,
                }
              : undefined
          }
        />
      </div>

      {/* ── 2. IPO Board Preview ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-from" />
            <h2 className="text-base font-semibold text-text-primary">
              Active IPO Pipeline
            </h2>
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-bold bg-surface-elevated text-text-muted">
              {ipos.filter(i => i.status === 'open' || i.status === 'closing_today').length} active
            </span>
          </div>
          <button
            onClick={() => window.location.href = '/ipos'}
            className="text-2xs text-brand-from hover:text-brand-from/80 font-medium transition-colors"
          >
            View all →
          </button>
        </div>

        <IpoBoard ipos={ipos} accounts={accounts} maxItemsPerTab={3} showViewAll={false} />
      </section>

      {/* ── 3. Two-Column Lower Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {plan ? (
            <AllocationSummary plan={plan} />
          ) : (
            <div className="card p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-text-muted/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Family Allocation Plan</p>
                  <p className="text-2xs text-text-muted mt-1">
                    Calculate mathematically optimal family bids across all active IPOs
                  </p>
                </div>
                <button
                  onClick={() => handleCalculatePlan(true)}
                  disabled={loadingPlan}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {loadingPlan ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Optimizing with PuLP...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Calculate Allocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}