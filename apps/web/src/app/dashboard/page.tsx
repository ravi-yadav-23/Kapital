'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { Ipo, FundSummary, PnlSummary, AllocationPlan, FamilyAccount } from '@/types'
import { StatCard } from '@/components/shared/StatCard'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { IpoBoard } from '@/components/ipo/IpoBoard'
import { AllocationSummary } from '@/components/dashboard/AllocationSummary'
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed'
import { useAuth } from '@/lib/auth-context'
import {
  Wallet,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Layers,
  Zap,
  Clock,
  DollarSign,
  ArrowUpRight,
  PlusCircle,
  ShieldCheck,
  Eye,
  Sliders,
} from 'lucide-react'
import { LiveProfitAllocationCalculator } from '@/components/landing/LiveProfitAllocationCalculator'

// Realistic Demo Dataset seeded for Guest/Recruiter preview
const DEMO_FUND_SUMMARY: FundSummary = {
  total_family_balance: 1400000,
  total_locked_asba: 580000,
  total_available: 820000,
  utilization_percent: 41.4,
  accounts_total: 6,
  accounts_active: 6,
}

const DEMO_PNL_SUMMARY: PnlSummary = {
  total_invested: 580000,
  total_realized_pnl: 18400,
  total_unrealized_pnl: 42100,
  total_pnl: 60500,
  overall_roi_percent: 3.2,
  total_applied_ipos: 5,
  total_allotments: 3,
  allotment_rate_percent: 66.7,
  total_sold: 2,
  total_holding: 3,
  best_ipo: { name: 'Bonfiglioli Transmissions', roi: 27.8 },
}

const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: 'demo-1',
    title: 'Allotment Confirmed: Bonfiglioli Transmissions',
    description: '1 Lot (29 shares) successfully allotted in sHNI category across Ramesh Account.',
    timestamp: '2 hours ago',
    type: 'allotment',
    badge: 'ALLOTTED',
  },
  {
    id: 'demo-2',
    title: 'Multi-Agent Score Published: Tonbo Imaging',
    description: 'Composite score 74/100 (DRHP Fundamentals: 82, GMP Sentiment: 78). Recommended: Apply.',
    timestamp: '5 hours ago',
    type: 'score',
    badge: 'SCORE 74',
  },
  {
    id: 'demo-3',
    title: 'Pre-Open Exit Mandate Staged',
    description: 'Angel One SmartAPI trailing stop order scheduled for 09:00 AM on listing day.',
    timestamp: 'Yesterday',
    type: 'funds',
    badge: 'STAGED',
  },
]

export default function DashboardPage() {
  const { user, isGuest } = useAuth()

  // Initialize immediately from in-memory cache or demo fallback so tab switching has 0ms loading lag
  const [ipos, setIpos] = useState<Ipo[]>(() => apiClient.getCachedIpos() || [])
  const [accounts, setAccounts] = useState<FamilyAccount[]>(() => apiClient.getCachedAccounts() || [])
  const [fundSummary, setFundSummary] = useState<FundSummary | null>(() => {
    const cached = apiClient.getCachedFundSummary()
    if (cached) return cached
    return isGuest ? DEMO_FUND_SUMMARY : null
  })
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(() => {
    const cached = apiClient.getCachedPnlSummary()
    if (cached) return cached
    return isGuest ? DEMO_PNL_SUMMARY : null
  })
  const [plan, setPlan] = useState<AllocationPlan | null>(null)

  // If we already have cached/guest fund summary or cached IPOs, skip skeleton loading entirely
  const [loading, setLoading] = useState<boolean>(() => {
    const hasIpos = (apiClient.getCachedIpos()?.length ?? 0) > 0
    const hasFunds = apiClient.getCachedFundSummary() !== null || isGuest
    return !(hasIpos || hasFunds)
  })
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)

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
    let isMounted = true

    async function loadDashboardData() {
      try {
        const [iposData, fundsData, pnlData, accountsData] = await Promise.all([
          apiClient.getIpos(),
          apiClient.getFundSummary(),
          apiClient.getPnlSummary(),
          apiClient.getAccounts(),
        ])

        if (!isMounted) return

        setIpos(iposData)

        // If user is a Guest or if balance is 0 and empty, seed plausible demo data for recruiter inspection
        const guestOrEmpty = isGuest || (!fundsData?.total_family_balance && !accountsData?.length)
        if (guestOrEmpty) {
          setFundSummary(DEMO_FUND_SUMMARY)
          setPnlSummary(DEMO_PNL_SUMMARY)
        } else {
          setFundSummary(fundsData)
          setPnlSummary(pnlData)
        }

        setAccounts(accountsData || [])
      } catch (err) {
        console.error('Error loading dashboard data:', err)
        if (!isMounted) return
        setFundSummary(DEMO_FUND_SUMMARY)
        setPnlSummary(DEMO_PNL_SUMMARY)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }

      // Check for cached plan or fetch without blocking page render
      try {
        const planData = await apiClient.getAllocationPlan(false)
        if (isMounted) setPlan(planData)
      } catch (err) {
        console.warn('Deferred allocation plan load:', err)
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [isGuest])

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

  // Active metrics
  const openCount = ipos.filter((i) => i.status === 'open').length
  const closingTodayCount = ipos.filter((i) => i.status === 'closing_today').length
  const upcomingCount = ipos.filter((i) => i.status === 'upcoming').length
  const activeAllotmentsCount = pnlSummary?.total_holding ?? 0
  const isDemoMode = isGuest || fundSummary?.total_family_balance === DEMO_FUND_SUMMARY.total_family_balance

  // ── Quick Stats Bar ──────────────────────────────────────────────
  const QuickStatsBar = () => {
    const stats = [
      {
        label: 'Open IPOs',
        value: openCount,
        icon: <Zap className="w-3.5 h-3.5 text-accent-green" />,
        color: 'text-accent-green',
      },
      {
        label: 'Closing Today',
        value: closingTodayCount,
        icon: <Clock className="w-3.5 h-3.5 text-accent-amber" />,
        color: 'text-accent-amber',
      },
      {
        label: 'Upcoming',
        value: upcomingCount,
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-accent-blue" />,
        color: 'text-accent-blue',
      },
      {
        label: 'Allotted',
        value: activeAllotmentsCount,
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
            <span>Your IPO command center.</span>
            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-accent-green/15 text-accent-green border border-accent-green/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              LIVE
            </span>
            {isDemoMode && (
              <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-medium bg-brand-from/10 text-brand-from border border-brand-from/25 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Demo Preview Mode
              </span>
            )}
          </h1>
          <p className="text-sm text-text-muted">
            Live: {openCount} open · {closingTodayCount} closing today · {upcomingCount} upcoming · {activeAllotmentsCount} allotments active
          </p>
        </div>
        <QuickStatsBar />
      </div>

      {/* ── 1. Stats Row (4 Cards with Demo & Contextual Empty States) ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Family Corpus */}
        {(fundSummary?.total_family_balance ?? 0) > 0 ? (
          <StatCard
            title="Total Family Corpus"
            value={<AmountDisplay amount={fundSummary?.total_family_balance || 0} />}
            subtitle={`Across ${fundSummary?.accounts_total ?? 0} family accounts`}
            icon={<Layers className="w-4 h-4 text-brand-from" />}
          />
        ) : (
          <StatCard
            title="Total Family Corpus"
            value={<span className="text-sm font-semibold text-text-secondary">No Accounts Linked</span>}
            subtitle="Connect Angel One accounts to pool corpus"
            icon={<Layers className="w-4 h-4 text-brand-from" />}
            action={{
              label: 'Link Accounts',
              href: '/settings',
            }}
          />
        )}

        {/* Card 2: Available to Deploy */}
        {(fundSummary?.total_available ?? 0) > 0 ? (
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
        ) : (
          <StatCard
            title="Available to Deploy"
            value={<span className="text-sm font-semibold text-text-secondary">₹0 Liquid</span>}
            subtitle="Link accounts to view ASBA deployable capital"
            icon={<Wallet className="w-4 h-4 text-accent-green" />}
            action={{
              label: 'Add Capital',
              href: '/funds',
            }}
          />
        )}

        {/* Card 3: Active Allotments */}
        {(pnlSummary?.total_holding ?? 0) > 0 ? (
          <StatCard
            title="Active Allotments"
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{pnlSummary?.total_holding}</span>
                <span className="text-xs text-text-muted font-normal">Active Lots</span>
              </div>
            }
            subtitle={`${pnlSummary?.total_allotments || 0} total lifetime allotments`}
            icon={<CheckCircle2 className="w-4 h-4 text-accent-purple" />}
            delta={{
              value: '+27.8% Exp. Gain',
              isPositive: true,
            }}
          />
        ) : (
          <StatCard
            title="Active Allotments"
            value={<span className="text-sm font-semibold text-text-secondary">0 Active Lots</span>}
            subtitle="Apply to open issues to secure allotments"
            icon={<CheckCircle2 className="w-4 h-4 text-accent-purple" />}
            action={{
              label: 'Explore Open IPOs',
              href: '/ipos',
            }}
          />
        )}

        {/* Card 4: Total Realized P&L */}
        {(pnlSummary?.total_realized_pnl ?? 0) > 0 ? (
          <StatCard
            title="Total Realized P&L"
            value={<AmountDisplay amount={pnlSummary?.total_realized_pnl || 0} className="text-accent-green" />}
            subtitle={`${pnlSummary?.allotment_rate_percent || 0}% overall hit rate`}
            icon={<TrendingUp className="w-4 h-4 text-accent-green" />}
            delta={{
              value: `+${pnlSummary?.overall_roi_percent || 0}% ROI`,
              isPositive: true,
            }}
          />
        ) : (
          <StatCard
            title="Total Realized P&L"
            value={<span className="text-sm font-semibold text-text-secondary">₹0 Realized</span>}
            subtitle="Automated 9:00 AM listing exits will record gains here"
            icon={<TrendingUp className="w-4 h-4 text-accent-green" />}
            action={{
              label: 'View Orders',
              href: '/orders',
            }}
          />
        )}
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
              {ipos.filter((i) => i.status === 'open' || i.status === 'closing_today').length} active
            </span>
          </div>
          <Link
            href="/ipos"
            className="text-2xs text-brand-from hover:text-brand-from/80 font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        <IpoBoard ipos={ipos} accounts={accounts} maxItemsPerTab={3} showViewAll={false} />
      </section>

      {/* ── 3. Interactive Profit & Allocation Simulator Sandbox ───── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-elevated/40 border border-border-subtle rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-from/15 border border-brand-from/30 flex items-center justify-center text-brand-from">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Family Capital & Profit Simulator
              </h3>
              <p className="text-2xs text-text-muted">
                Simulate your corpus allocation and expected listing gains before placing real ASBA bids
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="self-start sm:self-auto text-xs font-semibold px-3.5 py-2 rounded-xl bg-surface-card border border-border-default hover:border-brand-from/50 text-text-primary transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-from" />
            {showSimulator ? 'Close Simulator' : 'Open Profit Calculator'}
          </button>
        </div>

        {showSimulator && (
          <div className="animate-fade-in">
            <LiveProfitAllocationCalculator />
          </div>
        )}
      </section>

      {/* ── 4. Two-Column Lower Grid ───────────────────────────────── */}
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
          <ActivityFeed activities={isDemoMode ? DEMO_ACTIVITIES : []} />
        </div>
      </div>
    </div>
  )
}