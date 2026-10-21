'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount } from '@/types'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { StatusPill } from '@/components/shared/StatusPill'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { IpoScoreRadar } from '@/components/ipo/IpoScoreRadar'
import { IpoScoreBreakdown } from '@/components/ipo/IpoScoreBreakdown'
import { RedFlagList } from '@/components/ipo/RedFlagList'
import { SubscriptionBar } from '@/components/ipo/SubscriptionBar'
import { IpoSchedule } from '@/components/ipo/IpoSchedule'
import { ApplyModal } from '@/components/ipo/ApplyModal'
import { formatPercent, formatDate } from '@/lib/formatters'
import {
  ArrowLeft,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Send,
  Download,
  Building2,
  Calendar,
  Sparkles,
  Clock,
} from 'lucide-react'

export default function IpoDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [ipo, setIpo] = useState<Ipo | null>(null)
  const [accounts, setAccounts] = useState<FamilyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [isApplyOpen, setIsApplyOpen] = useState(false)

  useEffect(() => {
    if (id) {
      setLoading(true)
      Promise.all([
        apiClient.getIpoById(id).catch(() => null),
        apiClient.getAccounts().catch(() => []),
      ])
        .then(([ipoData, accsData]) => {
          setIpo(ipoData)
          setAccounts(accsData || [])
        })
        .catch((err) => {
          console.warn('[IPO Detail] Error loading IPO:', err)
          setIpo(null)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [id])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="card h-32 skeleton" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card h-96 skeleton" />
            <div className="card h-96 skeleton" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!ipo) {
    return (
      <DashboardLayout>
        <div className="card p-12 text-center text-text-muted space-y-3">
          <p className="text-sm">IPO not found or has expired.</p>
          <Link href="/ipos" className="btn btn-primary btn-sm">
            Back to IPO Board
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const isClosed = ipo.status === 'closed' || ipo.status === 'allotted' || ipo.status === 'listed'
  const isOpen = ipo.status === 'open' || ipo.status === 'closing_today'
  const isUpcoming = ipo.status === 'upcoming'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href="/ipos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to IPO Pipeline</span>
        </Link>

        {/* ── 1. Top Identity Header ───────────────────────────────────────── */}
        <div className="card p-6 bg-surface-card border-border-default space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {ipo.logo_url ? (
                <img
                  src={ipo.logo_url}
                  alt={ipo.name}
                  className="w-14 h-14 rounded-xl object-contain bg-white/5 p-2 border border-border-subtle flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-surface-elevated flex items-center justify-center font-bold text-xl text-brand-from border border-border-subtle flex-shrink-0">
                  {ipo.symbol.slice(0, 3)}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-text-primary">{ipo.name}</h1>
                  <StatusPill status={ipo.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1 font-mono">
                  <span className="font-bold text-text-secondary">{ipo.symbol}</span>
                  <span>•</span>
                  <span className="uppercase text-brand-from font-semibold bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]">
                    {ipo.type} Issue
                  </span>
                  <span>•</span>
                  <span>Issue Size: <strong className="text-text-primary">{ipo.issue_size}</strong></span>
                </div>
              </div>
            </div>

            {/* Score & Verdict Banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-elevated border border-border-subtle self-start md:self-auto">
              <div className="text-right">
                <span className="text-2xs text-text-muted uppercase font-semibold block">
                  AI Investment Grade
                </span>
                <span className="text-xs font-bold text-text-primary">
                  {ipo.recommendation?.replace('_', ' ')}
                </span>
              </div>
              <ScoreBadge score={ipo.score} size="lg" />
            </div>
          </div>
        </div>

        {/* ── 2. Two-Column Main Layout ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column (2 Spans): AI Deep Dive, Radar, Red Flags, About ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Radar Chart & Dimension Score Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IpoScoreRadar breakdown={ipo.score_breakdown} score={ipo.score} />
              <IpoScoreBreakdown breakdown={ipo.score_breakdown} />
            </div>

            {/* Red Flag Audit Report */}
            <RedFlagList redFlags={ipo.red_flags} />

            {/* Live Subscription Status */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Market Demand
              </h3>
              <SubscriptionBar
                retail={ipo.subscription_retail}
                shni={ipo.subscription_shni}
                bhni={ipo.subscription_bhni}
                total={ipo.subscription_total}
                compact={false}
              />
            </div>

            {/* Company Overview & Background */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-from" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Business Overview & Operations
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{ipo.about}</p>
            </div>

            {/* Key Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card space-y-3">
                <div className="flex items-center gap-2 text-accent-green font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Key Strengths & Growth Drivers</span>
                </div>
                <ul className="space-y-2 text-2xs text-text-secondary list-disc list-inside">
                  {ipo.strengths.map((s, i) => (
                    <li key={i} className="leading-snug">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="card space-y-3">
                <div className="flex items-center gap-2 text-accent-amber font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Risk Factors & Constraints</span>
                </div>
                <ul className="space-y-2 text-2xs text-text-secondary list-disc list-inside">
                  {ipo.risks.map((r, i) => (
                    <li key={i} className="leading-snug">{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Right Column (1 Span): Action Card, Price & Schedule ── */}
          <div className="space-y-6">
            {/* Apply & Action Card */}
            <div className="card bg-surface-card space-y-4 border-brand-from/30 shadow-xl shadow-brand-from/5">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                  <Sparkles className="w-4 h-4 text-brand-from" />
                  <span>Instant Application</span>
                </div>
                {ipo.gmp_percent !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-accent-green">
                    <Flame className="w-3.5 h-3.5 fill-accent-green/20" />
                    +{ipo.gmp_percent}% GMP
                  </span>
                )}
              </div>

              {/* Price Band & Min Investment Specs */}
              <div className="space-y-2 text-xs divide-y divide-border-subtle">
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Price Band</span>
                  <span className="font-mono font-bold text-text-primary">
                    ₹{ipo.price_band_min} - ₹{ipo.price_band_max}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Minimum Lot Size</span>
                  <span className="font-mono font-semibold">{ipo.lot_size} shares</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Min Retail Investment</span>
                  <AmountDisplay amount={ipo.min_investment} className="text-xs font-bold text-accent-green" />
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Issue Open Date</span>
                  <span className="font-mono text-text-secondary">{formatDate(ipo.issue_open_date)}</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Issue Close Date</span>
                  <span className="font-mono font-semibold text-accent-amber">{formatDate(ipo.issue_close_date)}</span>
                </div>
              </div>

              {/* Action Button */}
              {isOpen ? (
                <button
                  type="button"
                  onClick={() => setIsApplyOpen(true)}
                  className="btn btn-primary w-full justify-center py-2.5 text-xs gap-2 font-bold shadow-lg shadow-brand-from/25"
                >
                  <Send className="w-4 h-4" />
                  <span>Apply via Angel SmartAPI</span>
                </button>
              ) : isUpcoming ? (
                <div className="p-3.5 rounded-xl bg-accent-blue/10 border border-accent-blue/30 text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-accent-blue">
                    <Clock className="w-4 h-4" />
                    <span>Bidding Window Opens {formatDate(ipo.issue_open_date)}</span>
                  </div>
                  <p className="text-2xs text-text-secondary leading-relaxed">
                    Stock exchanges (NSE/BSE) only accept ASBA retail bids during market hours (10:00 AM – 5:00 PM IST) on open dates.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-surface-elevated text-center text-xs text-text-muted font-semibold">
                  Issue is Closed for Bidding
                </div>
              )}

              <Link href="/funds" className="btn btn-ghost btn-sm w-full justify-center text-2xs">
                View Allocation in Fund Manager →
              </Link>
            </div>

            {/* Lifecycle Timeline */}
            <IpoSchedule schedule={ipo.schedule} />

            {/* Official Filings & Links */}
            <div className="card space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Official Sources & Filings
              </h3>

              <div className="space-y-1.5 text-xs">
                {ipo.prospectus_url && (
                  <a
                    href={ipo.prospectus_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated hover:bg-surface-card transition-colors text-text-secondary hover:text-brand-from border border-border-subtle"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5" />
                      <span>Download DRHP / RHP</span>
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}

                {ipo.bse_info_url && (
                  <a
                    href={ipo.bse_info_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated hover:bg-surface-card transition-colors text-text-secondary hover:text-brand-from border border-border-subtle"
                  >
                    <span>BSE Public Issue Page</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Apply Modal */}
        <ApplyModal
          ipo={ipo}
          accounts={accounts}
          isOpen={isApplyOpen}
          onClose={() => setIsApplyOpen(false)}
        />
      </div>
    </DashboardLayout>
  )
}
