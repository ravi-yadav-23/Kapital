'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount, AiReport } from '@/types'
import { MOCK_IPOS, MOCK_ACCOUNTS } from '@/lib/mock-data'
import { IpoSchedule } from '@/components/ipo/IpoSchedule'
import { ApplyModal } from '@/components/ipo/ApplyModal'
import {
  formatDate,
  formatINR,
  formatPercent,
  computeIpoStatus,
  getCompanyAvatarProps,
  getStatusDotClass,
  getStatusPillClass,
  getStatusLabel,
  getScoreBarColor,
} from '@/lib/formatters'
import {
  ArrowLeft,
  ExternalLink,
  Download,
  AlertTriangle,
  Send,
} from 'lucide-react'

export default function IpoDetailPage() {
  const params = useParams()
  const id = (params?.id as string) || ''
  const [ipo, setIpo] = useState<Ipo | null>(() => {
    return MOCK_IPOS.find((i) => i.id === id || i.slug === id || i.symbol?.toLowerCase() === id.toLowerCase()) || null
  })
  const [report, setReport] = useState<AiReport | null>(null)
  const [accounts, setAccounts] = useState<FamilyAccount[]>(() => {
    const cached = apiClient.getCachedAccounts()
    return cached && cached.length > 0 ? cached : MOCK_ACCOUNTS
  })
  const [loading, setLoading] = useState(false)
  const [isApplyOpen, setIsApplyOpen] = useState(false)

  useEffect(() => {
    if (id) {
      setLoading(true)
      Promise.all([
        apiClient.getIpoById(id).catch(() => null),
        apiClient.getAccounts().catch(() => []),
        apiClient.getReportById(id).catch(() => null),
      ])
        .then(([ipoData, accsData, repData]) => {
          if (ipoData) setIpo(ipoData)
          if (accsData && accsData.length > 0) setAccounts(accsData)
          if (repData) setReport(repData)
        })
        .catch((err) => {
          console.warn('[IPO Detail] Error loading IPO:', err)
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
          <div className="card h-28 skeleton" />
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
        <div className="card p-12 text-center space-y-3">
          <p className="text-xs text-[var(--ink-2)]">IPO not found or has expired.</p>
          <Link href="/ipos" className="btn btn-secondary btn-sm inline-flex">
            Back to IPO Pipeline
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const effectiveStatus = computeIpoStatus(ipo.issue_open_date, ipo.issue_close_date)
  const isOpen = effectiveStatus === 'open' || effectiveStatus === 'closing_today'
  const isUpcoming = effectiveStatus === 'upcoming'

  // Is this an actual AI audit or preliminary estimate?
  const isAudited = Boolean(
    report?.is_audited ||
    (report?.red_flags && report.red_flags.length > 0) ||
    (ipo.red_flags && ipo.red_flags.length > 0)
  )

  const breakdown = report?.score_breakdown || ipo.score_breakdown
  const score = isAudited ? (report?.overall_score || ipo.score || 0) : (ipo.score || 0)
  const recommendation = isAudited
    ? (report?.recommendation || ipo.recommendation)
    : ipo.recommendation
  const avatar = getCompanyAvatarProps(ipo.name)
  const redFlagsList = (report?.red_flags && report.red_flags.length > 0) ? report.red_flags : ipo.red_flags || []

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        {/* Back Link */}
        <Link
          href="/ipos"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to IPO Pipeline</span>
        </Link>

        {/* ── 1. Top Identity Header ───────────────────────────────────────── */}
        <div className="p-6 rounded-sm bg-surface border border-line space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-sm border flex items-center justify-center font-mono text-[14px] font-medium flex-shrink-0 ${avatar.bg} ${avatar.text}`}
              >
                {avatar.initials}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[20px] font-medium text-ink tracking-tight">
                    {ipo.name}
                  </h1>
                  <span className={getStatusPillClass(effectiveStatus)}>
                    <span className={getStatusDotClass(effectiveStatus)} />
                    <span>{getStatusLabel(effectiveStatus)}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[13px] font-mono text-ink-3 mt-1">
                  <span>{ipo.symbol}</span>
                  <span>·</span>
                  <span>{ipo.type || 'EQ'}</span>
                  <span>·</span>
                  <span>Issue size: {ipo.issue_size || '—'}</span>
                  {ipo.gmp_percent !== undefined && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400 font-medium">
                        +{ipo.gmp_percent}% GMP
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Score Pill & Bar */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] font-mono uppercase text-ink-3 block">
                  AI Verdict
                </span>
                <span className="text-[13px] font-medium text-ink-2">
                  {isAudited
                    ? (recommendation?.replace('_', ' ') || 'UNDER REVIEW')
                    : 'PRELIMINARY ESTIMATE'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[32px] font-mono font-medium text-ink tabular-nums leading-none">
                  {score}<span className="text-[13px] text-ink-3">/100</span>
                </span>
              </div>
            </div>
          </div>

          {/* 6px Horizontal score bar colored by verdict band */}
          <div className="h-[6px] w-full bg-surface-raised rounded-full overflow-hidden border border-line">
            <div
              className={`h-full ${getScoreBarColor(score)} transition-all`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* ── 2. Two-Column Main Layout ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Spans): AI Due Diligence, Dimensions, Red Flags */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dimension Breakdown */}
            {breakdown && (
              <div className="p-5 rounded-sm bg-surface border border-line space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-ink">
                    Scoring dimension breakdown
                  </h3>
                  <span className="text-[12px] text-ink-3">
                    0–100 scale · {isAudited ? 'DRHP audit verified' : 'Live market weighted'}
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {[
                    { label: 'Financial quality & DRHP audit', score: breakdown.financial_quality, weight: '25%', maxPts: 25 },
                    { label: 'Valuation safety & multiples', score: breakdown.valuation_safety, weight: '20%', maxPts: 20 },
                    { label: 'Grey market premium (GMP)', score: breakdown.gmp_strength, weight: '20%', maxPts: 20 },
                    { label: 'Promoter integrity & governance', score: breakdown.promoter_integrity, weight: '15%', maxPts: 15 },
                    { label: 'Industry sector tailwinds', score: breakdown.industry_tailwinds, weight: '10%', maxPts: 10 },
                    { label: 'Subscription & institutional demand', score: breakdown.subscription_momentum, weight: '10%', maxPts: 10 },
                  ].map((dim, i) => {
                    const earned =
                      dim.score !== null && dim.score !== undefined
                        ? Math.round(((dim.score * dim.maxPts) / 100) * 10) / 10
                        : null

                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="text-ink font-sans">{dim.label}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-[12px] text-ink-3 font-sans">
                              Weight: {dim.weight}
                            </span>
                            {earned !== null && (
                              <span className="text-ink font-medium tabular-nums">
                                {earned}/{dim.maxPts} pts
                              </span>
                            )}
                            <span className="text-[12px] text-ink-3 tabular-nums font-mono">
                              ({dim.score !== null && dim.score !== undefined ? `${dim.score}/100` : 'Not assessed'})
                            </span>
                          </div>
                        </div>
                        {dim.score !== null && dim.score !== undefined && (
                          <div className="h-[6px] w-full bg-surface-raised rounded-full overflow-hidden border border-line">
                            <div
                              className={`h-full ${getScoreBarColor(dim.score)} transition-all duration-300`}
                              style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Red Flag Audit Report */}
            {redFlagsList && redFlagsList.length > 0 ? (
              <div className="p-5 rounded-sm bg-surface border border-line space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-[14px] font-medium text-ink">
                    Forensic red flags ({redFlagsList.length})
                  </h3>
                </div>

                <div className="space-y-2 pt-1">
                  {redFlagsList.map((rf: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-sm border border-line bg-canvas text-[13px] text-ink-2 leading-relaxed"
                    >
                      {typeof rf === 'string' ? rf : rf.text || rf.title || rf.description}
                    </div>
                  ))}
                </div>
              </div>
            ) : isAudited ? (
              <div className="p-4 rounded-sm border border-line bg-surface flex items-center justify-between text-[13px] text-ink-2">
                <span className="text-emerald-400 flex items-center gap-2">
                  <span>✓</span> Clean DRHP Audit — Zero severe accounting anomalies or promoter litigation red flags detected.
                </span>
                <Link href="/reports" className="btn-secondary text-[13px] py-1 px-3">
                  View Full Report →
                </Link>
              </div>
            ) : (
              <div className="p-4 rounded-sm border border-line bg-surface flex items-center justify-between text-[13px] text-ink-2">
                <span>No audit has run, so red flags are unknown.</span>
                <Link href="/reports" className="btn-secondary text-[13px] py-1 px-3">
                  Open AI Reports →
                </Link>
              </div>
            )}

            {/* Business Overview */}
            <div className="card p-5 space-y-2">
              <h3 className="text-sm font-medium text-[var(--ink-1)]">
                Company Overview
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {ipo.about || 'Business operations and DRHP draft prospectus information is synced from official exchange filings.'}
              </p>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-mono uppercase text-[var(--ink-3)]">
                  Key Strengths
                </h4>
                <ul className="space-y-1.5 text-xs text-[var(--ink-2)] list-disc list-inside">
                  {(ipo.strengths || []).map((s, i) => (
                    <li key={i} className="leading-snug">{s}</li>
                  ))}
                  {(!ipo.strengths || ipo.strengths.length === 0) && (
                    <li className="list-none text-2xs text-[var(--ink-3)]">None documented in prospectus summary.</li>
                  )}
                </ul>
              </div>

              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-mono uppercase text-[var(--ink-3)]">
                  Key Risk Factors
                </h4>
                <ul className="space-y-1.5 text-xs text-[var(--ink-2)] list-disc list-inside">
                  {(ipo.risks || []).map((r, i) => (
                    <li key={i} className="leading-snug">{r}</li>
                  ))}
                  {(!ipo.risks || ipo.risks.length === 0) && (
                    <li className="list-none text-2xs text-[var(--ink-3)]">No critical risks flagged.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column (1 Span): Specs, Schedule, Actions */}
          <div className="space-y-6">
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-medium text-[var(--ink-1)] pb-2 border-b border-[var(--border-default)]">
                Issue Parameters
              </h3>

              <div className="space-y-2 text-xs divide-y divide-[var(--border-default)]">
                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--ink-3)]">Price Band</span>
                  <span className="font-mono text-[var(--ink-1)] tabular-nums">
                    ₹{ipo.price_band_min} – ₹{ipo.price_band_max}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--ink-3)]">Lot Size</span>
                  <span className="font-mono text-[var(--ink-1)] tabular-nums">{ipo.lot_size} shares</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--ink-3)]">Min Retail Investment</span>
                  <span className="font-mono text-[var(--ink-1)] font-medium tabular-nums">
                    {formatINR(ipo.min_investment)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--ink-3)]">Open Date</span>
                  <span className="font-mono text-[var(--ink-2)]">{formatDate(ipo.issue_open_date)}</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--ink-3)]">Close Date</span>
                  <span className="font-mono text-[var(--ink-2)]">{formatDate(ipo.issue_close_date)}</span>
                </div>

                {ipo.listing_date && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--ink-3)]">Listing Date</span>
                    <span className="font-mono text-[var(--ink-2)]">{formatDate(ipo.listing_date)}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {isOpen ? (
                <button
                  type="button"
                  onClick={() => setIsApplyOpen(true)}
                  className="btn btn-primary btn-md w-full justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Apply via SmartAPI</span>
                </button>
              ) : isUpcoming ? (
                <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-center text-xs text-[var(--ink-2)]">
                  Opens for bidding on {formatDate(ipo.issue_open_date)}
                </div>
              ) : (
                <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-center text-xs text-[var(--ink-3)]">
                  Issue Closed
                </div>
              )}

              <Link href="/funds" className="btn btn-secondary btn-sm w-full justify-center text-xs">
                View Allocation in Fund Manager
              </Link>
            </div>

            {/* Schedule */}
            {ipo.schedule && ipo.schedule.length > 0 && (
              <IpoSchedule schedule={ipo.schedule} />
            )}

            {/* Official Filings */}
            <div className="card p-5 space-y-3">
              <h3 className="text-xs font-mono uppercase text-[var(--ink-3)]">
                Filings & Documents
              </h3>

              <div className="space-y-1.5 text-xs">
                {ipo.prospectus_url && (
                  <a
                    href={ipo.prospectus_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] transition-colors text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-[var(--ink-3)]" />
                      <span>Download DRHP / RHP</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)]" />
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
