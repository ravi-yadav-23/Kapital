'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, AiReport } from '@/types'
import { MOCK_IPOS, MOCK_REPORTS } from '@/lib/mock-data'
import {
  formatPercent,
  formatRelativeDate,
  computeIpoStatus,
  getCompanyAvatarProps,
  getStatusDotClass,
  getStatusPillClass,
  getStatusLabel,
  getScoreRecommendation,
  getRecommendationLabel,
  getScoreBarColor,
} from '@/lib/formatters'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import { stripHtml } from '@/lib/utils'

export default function ReportsPage() {
  const [ipos, setIpos] = useState<Ipo[]>(() => {
    const cached = apiClient.getCachedIpos()
    return cached && cached.length > 0 ? cached : MOCK_IPOS
  })
  const [reports, setReports] = useState<Record<string, AiReport>>(() => {
    const repMap: Record<string, AiReport> = {}
    MOCK_REPORTS.forEach((r) => {
      if (r.ipo_id) repMap[r.ipo_id] = r
    })
    return repMap
  })
  const [loading, setLoading] = useState(false)
  const [selectedIpo, setSelectedIpo] = useState<Ipo | null>(() => {
    const all = apiClient.getCachedIpos()?.length ? apiClient.getCachedIpos()! : MOCK_IPOS
    return (
      all.find((i) => {
        const st = computeIpoStatus(i.issue_open_date, i.issue_close_date)
        return st === 'open' || st === 'closing_today'
      }) ||
      all.find((i) => computeIpoStatus(i.issue_open_date, i.issue_close_date) === 'upcoming') ||
      all[0] ||
      null
    )
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadData = async () => {
    try {
      const [allIpos, allReports] = await Promise.all([
        apiClient.getIpos(),
        apiClient.getReports(),
      ])
      if (allIpos && allIpos.length > 0) {
        setIpos(allIpos)
      }

      const repMap: Record<string, AiReport> = {}
      if (allReports && allReports.length > 0) {
        allReports.forEach((r) => {
          if (r.ipo_id) repMap[r.ipo_id] = r
        })
        setReports((prev) => ({ ...prev, ...repMap }))
      }

      if (allIpos && allIpos.length > 0 && !selectedIpo) {
        const activeFirst =
          allIpos.find((i) => {
            const st = computeIpoStatus(i.issue_open_date, i.issue_close_date)
            return st === 'open' || st === 'closing_today'
          }) ||
          allIpos.find((i) => computeIpoStatus(i.issue_open_date, i.issue_close_date) === 'upcoming') ||
          allIpos[0]
        setSelectedIpo(activeFirst)
      }
    } catch (err) {
      console.error('Failed to load reports page data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const currentReport: AiReport | null = useMemo(() => {
    if (!selectedIpo) return null
    return reports[selectedIpo.id] || null
  }, [selectedIpo, reports])

  const handleSelectIpo = async (ipo: Ipo) => {
    setSelectedIpo(ipo)
    if (!reports[ipo.id]) {
      try {
        const rep = await apiClient.getReportById(ipo.id)
        if (rep) {
          setReports((prev) => ({ ...prev, [ipo.id]: rep }))
        }
      } catch (err) {
        console.error('Failed to fetch report:', err)
      }
    }
  }

  const handleRunAiAudit = async () => {
    if (!selectedIpo) return
    setAnalyzing(true)
    try {
      const rep = await apiClient.generateReport(selectedIpo.id)
      if (rep) {
        setReports((prev) => ({ ...prev, [selectedIpo.id]: rep }))
        setToast({
          message: `AI due diligence audit completed for ${selectedIpo.name}!`,
          type: 'success',
        })
        setTimeout(() => setToast(null), 4000)
      }
    } catch (err: any) {
      console.error('Failed to run AI audit:', err)
      setToast({
        message: err.message || 'Audit unavailable. Please retry in a moment.',
        type: 'error',
      })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setAnalyzing(false)
    }
  }

  type ReportTab = 'all' | 'open' | 'upcoming' | 'closed'
  const [activeTab, setActiveTab] = useState<ReportTab>('open')

  const canonicalIpos = useMemo(() => {
    return ipos.map((i) => ({
      ...i,
      computedStatus: computeIpoStatus(i.issue_open_date, i.issue_close_date),
    }))
  }, [ipos])

  const openCount = useMemo(
    () => canonicalIpos.filter((i) => i.computedStatus === 'open' || i.computedStatus === 'closing_today').length,
    [canonicalIpos]
  )
  const upcomingCount = useMemo(
    () => canonicalIpos.filter((i) => i.computedStatus === 'upcoming').length,
    [canonicalIpos]
  )
  const closedCount = useMemo(
    () => canonicalIpos.filter((i) => i.computedStatus === 'closed').length,
    [canonicalIpos]
  )
  const allCount = canonicalIpos.length

  const filteredIpos = useMemo(() => {
    return canonicalIpos.filter((ipo) => {
      if (activeTab === 'open' && ipo.computedStatus !== 'open' && ipo.computedStatus !== 'closing_today') return false
      if (activeTab === 'upcoming' && ipo.computedStatus !== 'upcoming') return false
      if (activeTab === 'closed' && ipo.computedStatus !== 'closed') return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return ipo.name.toLowerCase().includes(q) || ipo.symbol.toLowerCase().includes(q)
    })
  }, [canonicalIpos, activeTab, searchQuery])

  // Is this an actual AI audit or just preliminary sector estimate?
  // Backend now returns is_audited flag explicitly.
  const isAudited = Boolean(currentReport?.is_audited)

  const breakdown = currentReport?.score_breakdown || selectedIpo?.score_breakdown

  // Live factors fallback from live IPO data
  const gmpVal = breakdown?.gmp_strength ?? (selectedIpo?.gmp_percent ? Math.min(100, Math.round(selectedIpo.gmp_percent * 2)) : 60)
  const subVal = breakdown?.subscription_momentum ?? 65

  // When unaudited, headline score equals weighted sum of live factors (60% GMP + 40% sub)
  const compositeScore = isAudited
    ? (currentReport?.overall_score || selectedIpo?.score || 50)
    : (currentReport?.overall_score || Math.round(gmpVal * 0.60 + subVal * 0.40))

  const recommendation = currentReport?.recommendation || selectedIpo?.recommendation || getScoreRecommendation(compositeScore)
  const recLabel = getRecommendationLabel(recommendation)

  const redFlags = currentReport?.red_flags || selectedIpo?.red_flags || []
  const strengths = currentReport?.strengths || selectedIpo?.strengths || []

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-sm border text-[13px] shadow-modal flex items-center gap-2 animate-fade-in ${
              toast.type === 'success' ? 'bg-surface border-line text-ink' : 'bg-surface border-negative text-negative'
            }`}
          >
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-ink-3">✕</button>
          </div>
        )}

        {/* Top Action Strip (Sentence-case, single source of action) */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[13px] text-ink-2">
            Forensic analysis across DRHP filings, accounting anomalies, and grey market sentiment
          </div>
          <Link href="/funds" className="btn-secondary text-[13px]">
            <span>View allocation plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Master-Detail Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Compact IPO List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 border-b border-line pb-1.5 overflow-x-auto text-xs">
              {[
                { id: 'open' as ReportTab, label: 'Open', count: openCount },
                { id: 'upcoming' as ReportTab, label: 'Upcoming', count: upcomingCount },
                { id: 'closed' as ReportTab, label: 'Closed', count: closedCount },
                { id: 'all' as ReportTab, label: 'All', count: allCount },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-surface-raised text-ink font-medium border border-line'
                      : 'text-ink-3 hover:text-ink hover:bg-surface'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="font-mono text-[11px] text-ink-3">({t.count})</span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search report by company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-[13px] bg-surface border border-line rounded-sm text-ink placeholder:text-ink-3"
              />
            </div>

            <div className="rounded-sm border border-line bg-surface divide-y divide-line overflow-hidden max-h-[640px] overflow-y-auto">
              {filteredIpos.map((ipo) => {
                const isSelected = selectedIpo?.id === ipo.id
                const ipoScore = reports[ipo.id]?.overall_score || ipo.score || 50
                const ipoStatus = ipo.computedStatus
                const avatar = getCompanyAvatarProps(ipo.name)

                return (
                  <button
                    key={ipo.id}
                    onClick={() => handleSelectIpo(ipo)}
                    className={`w-full text-left p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-surface-selected text-ink' : 'hover:bg-surface-raised text-ink-2'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      {/* Company Avatar */}
                      <div
                        className={`w-7 h-7 rounded-sm border flex items-center justify-center font-mono text-[11px] font-medium flex-shrink-0 ${avatar.bg} ${avatar.text}`}
                      >
                        {avatar.initials}
                      </div>
                      <div className="truncate">
                        <div className={`text-[14px] truncate flex items-center gap-1.5 ${isSelected ? 'font-medium text-ink' : 'text-ink-2'}`}>
                          <span className="truncate">{ipo.name}</span>
                          {ipo.type === 'SME' ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                              SME
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0">
                              Mainboard
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] font-mono text-ink-3 mt-0.5 flex items-center gap-1.5">
                          <span className={getStatusDotClass(ipoStatus)} />
                          <span>{ipo.symbol}</span>
                          <span>·</span>
                          <span>{getStatusLabel(ipoStatus)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Score Number in Ink */}
                    <div className="flex items-center gap-1 flex-shrink-0 font-mono text-[13px]">
                      <span className="text-ink font-medium">
                        {ipoScore}
                      </span>
                      <span className="text-[13px] text-ink-3">/100</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: The Research Dossier */}
          <div className="lg:col-span-8 space-y-6">
            {selectedIpo ? (
              <div className="p-6 rounded-sm bg-surface border border-line space-y-6">
                {/* Header: Title + Audit Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[18px] font-medium text-ink">
                        {selectedIpo.name}
                      </h2>
                      {selectedIpo.type === 'SME' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          SME
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Mainboard
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-ink-2 mt-1">
                      {isAudited
                        ? 'AI forensic audit · Gemini Flash & Claude Haiku'
                        : 'Preliminary score · AI audit not run'}
                    </div>
                  </div>

                  {/* Primary CTA (Amber strictly for this button when unaudited) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunAiAudit}
                      disabled={analyzing}
                      className={isAudited ? 'btn-secondary text-[13px]' : 'btn-primary text-[13px]'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                      <span>{analyzing ? 'Auditing DRHP...' : isAudited ? 'Re-run AI audit' : 'Run AI Audit'}</span>
                    </button>
                  </div>
                </div>

                {/* Verdict & 6px Score Bar */}
                <div className="p-4 rounded-sm bg-surface-raised border border-line space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[13px] text-ink-3 block">
                        Conviction score
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        {/* Score number in ink, NOT amber */}
                        <span className="text-[32px] font-mono font-medium text-ink leading-none">
                          {compositeScore}
                        </span>
                        <span className="text-[13px] text-ink-3 font-mono">/ 100</span>
                        <span className="text-[13px] text-ink-3">·</span>
                        {/* Preliminary estimate in ink-2/muted, NOT amber */}
                        <span className="text-[13px] font-medium tracking-wide text-ink-2 uppercase">
                          {isAudited ? recLabel : 'Preliminary estimate'}
                        </span>
                      </div>
                    </div>

                    {(selectedIpo.gmp_percent || 0) > 0 && (
                      <div className="text-right">
                        <span className="text-[13px] text-ink-3 block">Listing gain</span>
                        <span className="text-[16px] font-mono font-medium text-emerald-400 mt-1 block">
                          ↑ {formatPercent(selectedIpo.gmp_percent)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 6px Score Bar colored by verdict band */}
                  <div className="w-full h-[6px] bg-surface rounded-full overflow-hidden border border-line">
                    <div
                      className={`h-full ${getScoreBarColor(compositeScore)} transition-all duration-400`}
                      style={{ width: `${compositeScore}%` }}
                    />
                  </div>
                </div>

                {/* 5-Factor Forensic Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-ink-2">
                      5-factor forensic breakdown
                    </div>
                    {!isAudited && (
                      <span className="text-[13px] text-ink-3">
                        DRHP factors require audit · live data weights total 100%
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {/* 1. Financial Quality (DRHP Analysis) */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-ink">Financial quality (DRHP analysis)</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '25%' : '—'})
                          </span>
                          <span className="text-ink font-medium">
                            {isAudited && breakdown?.financial_quality !== null && breakdown?.financial_quality !== undefined
                              ? `${breakdown.financial_quality}/100`
                              : 'Not assessed'}
                          </span>
                        </div>
                      </div>
                      {isAudited && breakdown?.financial_quality !== null && breakdown?.financial_quality !== undefined && (
                        <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${getScoreBarColor(breakdown.financial_quality)} transition-all duration-400`}
                            style={{ width: `${breakdown.financial_quality}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. Valuation Safety & Pricing Multiples */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-ink">Valuation safety & pricing multiples</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '20%' : '—'})
                          </span>
                          <span className="text-ink font-medium">
                            {isAudited && breakdown?.valuation_safety !== null && breakdown?.valuation_safety !== undefined
                              ? `${breakdown.valuation_safety}/100`
                              : 'Not assessed'}
                          </span>
                        </div>
                      </div>
                      {isAudited && breakdown?.valuation_safety !== null && breakdown?.valuation_safety !== undefined && (
                        <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${getScoreBarColor(breakdown.valuation_safety)} transition-all duration-400`}
                            style={{ width: `${breakdown.valuation_safety}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 3. Grey Market Premium (GMP Strength) - Live factor */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="text-ink">Grey market premium (GMP strength)</span>
                          {!isAudited && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">
                              from live data
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '20%' : '60%'})
                          </span>
                          <span className="text-ink font-medium">{gmpVal}/100</span>
                        </div>
                      </div>
                      <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                        <div
                          className={`h-full ${getScoreBarColor(gmpVal)} transition-all duration-400`}
                          style={{ width: `${gmpVal}%` }}
                        />
                      </div>
                    </div>

                    {/* 4. Promoter Integrity & Corporate Governance */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-ink">Promoter integrity & corporate governance</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '15%' : '—'})
                          </span>
                          <span className="text-ink font-medium">
                            {isAudited && breakdown?.promoter_integrity !== null && breakdown?.promoter_integrity !== undefined
                              ? `${breakdown.promoter_integrity}/100`
                              : 'Not assessed'}
                          </span>
                        </div>
                      </div>
                      {isAudited && breakdown?.promoter_integrity !== null && breakdown?.promoter_integrity !== undefined && (
                        <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${getScoreBarColor(breakdown.promoter_integrity)} transition-all duration-400`}
                            style={{ width: `${breakdown.promoter_integrity}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 5. Institutional Subscription Momentum - Live factor */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="text-ink">Institutional subscription momentum</span>
                          {!isAudited && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">
                              from live data
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '10%' : '40%'})
                          </span>
                          <span className="text-ink font-medium">{subVal}/100</span>
                        </div>
                      </div>
                      <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                        <div
                          className={`h-full ${getScoreBarColor(subVal)} transition-all duration-400`}
                          style={{ width: `${subVal}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forensic Red Flags & DRHP Audit */}
                <div className="space-y-3">
                  <div className="text-[13px] font-medium text-ink-2">
                    Forensic red flags & DRHP audit
                  </div>
                  <div className="space-y-2 text-[13px]">
                    {isAudited ? (
                      redFlags.length > 0 ? (
                        redFlags.map((flag, idx) => (
                          <div key={idx} className="p-3 rounded-sm border border-line bg-canvas flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-ink-2 flex-shrink-0 mt-0.5" />
                            <span className="text-ink-2">
                              {typeof flag === 'string' ? flag : (flag as any).text || (flag as any).description}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 rounded-sm border border-line bg-canvas flex items-center gap-2 text-ink-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>Audited: Zero critical promoter litigation or accounting anomalies found in DRHP.</span>
                        </div>
                      )
                    ) : (
                      /* Unaudited state: Truthful disclaimer with inline Run AI Audit action */
                      <div className="p-3.5 rounded-sm border border-line bg-surface-raised flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[13px]">
                        <div className="flex items-center gap-2.5 text-ink-2">
                          <AlertTriangle className="w-4 h-4 text-ink-3 flex-shrink-0" />
                          <span>No audit has run, so red flags are unknown.</span>
                        </div>
                        <button
                          onClick={handleRunAiAudit}
                          disabled={analyzing}
                          className="btn-primary text-[13px] py-1.5 px-3 flex-shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                          <span>{analyzing ? 'Auditing...' : 'Run AI Audit'}</span>
                        </button>
                      </div>
                    )}

                    {isAudited && strengths.slice(0, 2).map((str, idx) => (
                      <div key={`str-${idx}`} className="p-3 rounded-sm border border-line bg-canvas flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-ink-2">{typeof str === 'string' ? str : (str as any).text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Executive Research Summary */}
                <div className="space-y-2 border-t border-line pt-4">
                  <div className="text-[13px] font-medium text-ink-2">
                    Executive research summary
                  </div>
                  <p className="text-[13px] text-ink-2 leading-relaxed">
                    {currentReport?.executive_summary
                      ? stripHtml(currentReport.executive_summary)
                      : selectedIpo.about ||
                        `${selectedIpo.name} operates in the ${selectedIpo.type || 'EQ'} primary market segment with an issue size of ${selectedIpo.issue_size || 'N/A'}. Run an AI audit to extract forensic insights directly from SEBI DRHP filings.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-sm bg-surface border border-line text-center text-[13px] text-ink-3">
                Select an issue from the left panel to inspect its due diligence dossier.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
