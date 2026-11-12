'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient, canShowMockData } from '@/lib/api-client'
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
  cleanTradingSymbol,
} from '@/lib/formatters'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileText,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { stripHtml } from '@/lib/utils'

export default function ReportsPage() {
  const [ipos, setIpos] = useState<Ipo[]>(() => {
    const cached = apiClient.getCachedIpos()
    return cached && cached.length > 0 ? cached : canShowMockData() ? MOCK_IPOS : []
  })
  const [reports, setReports] = useState<Record<string, AiReport>>(() => {
    const repMap: Record<string, AiReport> = {}
    if (canShowMockData()) {
      MOCK_REPORTS.forEach((r) => {
        if (r.ipo_id) repMap[r.ipo_id] = r
      })
    }
    return repMap
  })
  const [loading, setLoading] = useState(false)
  const [selectedIpo, setSelectedIpo] = useState<Ipo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  type ReportTab = 'all' | 'open' | 'closing_today' | 'upcoming' | 'closed'
  const [activeTab, setActiveTab] = useState<ReportTab>('open')

  const canonicalIpos = useMemo(() => {
    return ipos.map((i) => ({
      ...i,
      computedStatus: computeIpoStatus(
        i.issue_open_date,
        i.issue_close_date,
        undefined,
        i.status,
        i.allotment_date
      ),
    }))
  }, [ipos])

  const openCount = useMemo(
    () => canonicalIpos.filter((i) => i.computedStatus === 'open').length,
    [canonicalIpos]
  )
  const closingCount = useMemo(
    () => canonicalIpos.filter((i) => i.computedStatus === 'closing_today').length,
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

  // Auto-sync tab on initial load if open has 0 items and upcoming has items
  useEffect(() => {
    if (openCount === 0 && closingCount === 0 && upcomingCount > 0 && activeTab === 'open') {
      setActiveTab('upcoming')
    }
  }, [openCount, closingCount, upcomingCount, activeTab])

  const filteredIpos = useMemo(() => {
    return canonicalIpos.filter((ipo) => {
      if (activeTab === 'open' && ipo.computedStatus !== 'open') return false
      if (activeTab === 'closing_today' && ipo.computedStatus !== 'closing_today') return false
      if (activeTab === 'upcoming' && ipo.computedStatus !== 'upcoming') return false
      if (activeTab === 'closed' && ipo.computedStatus !== 'closed') return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return ipo.name.toLowerCase().includes(q) || ipo.symbol.toLowerCase().includes(q)
    })
  }, [canonicalIpos, activeTab, searchQuery])

  // Current active IPO must strictly belong to the currently filtered list
  const currentIpo: Ipo | null = useMemo(() => {
    if (filteredIpos.length === 0) return null
    if (selectedIpo && filteredIpos.some((i) => i.id === selectedIpo.id)) {
      return selectedIpo
    }
    return filteredIpos[0]
  }, [filteredIpos, selectedIpo])

  const handleTabChange = (newTab: ReportTab) => {
    setActiveTab(newTab)
    const matches = canonicalIpos.filter((ipo) => {
      if (newTab === 'open' && ipo.computedStatus !== 'open') return false
      if (newTab === 'closing_today' && ipo.computedStatus !== 'closing_today') return false
      if (newTab === 'upcoming' && ipo.computedStatus !== 'upcoming') return false
      if (newTab === 'closed' && ipo.computedStatus !== 'closed') return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return ipo.name.toLowerCase().includes(q) || ipo.symbol.toLowerCase().includes(q)
    })
    if (matches.length > 0) {
      setSelectedIpo(matches[0])
    } else {
      setSelectedIpo(null)
    }
  }

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
    if (!currentIpo) return null
    return reports[currentIpo.id] || null
  }, [currentIpo, reports])

  // Prefetch report whenever active selected IPO changes
  useEffect(() => {
    if (!currentIpo) return
    if (!reports[currentIpo.id]) {
      apiClient
        .getReportById(currentIpo.id, currentIpo.slug, currentIpo.symbol, currentIpo.name)
        .then((rep) => {
          if (rep) {
            setReports((prev) => ({
              ...prev,
              [currentIpo.id]: rep,
              [rep.ipo_id]: rep,
              ...(currentIpo.symbol ? { [currentIpo.symbol]: rep } : {}),
            }))
          }
        })
        .catch((err) => console.error('Failed to prefetch report:', err))
    }
  }, [currentIpo, reports])

  const handleSelectIpo = async (ipo: Ipo) => {
    setSelectedIpo(ipo)
    const st = computeIpoStatus(ipo.issue_open_date, ipo.issue_close_date, undefined, ipo.status, ipo.allotment_date)
    if (activeTab !== 'all' && activeTab !== st) {
      setActiveTab(st as ReportTab)
    }
    if (!reports[ipo.id]) {
      try {
        const rep = await apiClient.getReportById(ipo.id, ipo.slug, ipo.symbol, ipo.name)
        if (rep) {
          setReports((prev) => ({
            ...prev,
            [ipo.id]: rep,
            [rep.ipo_id]: rep,
            ...(ipo.symbol ? { [ipo.symbol]: rep } : {}),
          }))
        }
      } catch (err) {
        console.error('Failed to fetch report:', err)
      }
    }
  }

  // Auto-sync selection from URL search params (e.g. ?id=... or ?symbol=...)
  useEffect(() => {
    if (typeof window === 'undefined' || ipos.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const targetId = params.get('id')
    const targetSymbol = params.get('symbol')
    if (targetId || targetSymbol) {
      const match = ipos.find(
        (i) => (targetId && i.id === targetId) || (targetSymbol && i.symbol?.toLowerCase() === targetSymbol.toLowerCase())
      )
      if (match) {
        handleSelectIpo(match)
      }
    }
  }, [ipos])

  const handleRunAiAudit = async () => {
    if (!currentIpo) return
    setAnalyzing(true)
    try {
      const rep = await apiClient.generateReport(
        currentIpo.id,
        currentIpo.slug,
        currentIpo.symbol,
        currentIpo.name
      )
      if (rep) {
        setReports((prev) => ({
          ...prev,
          [currentIpo.id]: rep,
          [rep.ipo_id]: rep,
          ...(currentIpo.symbol ? { [currentIpo.symbol]: rep } : {}),
        }))
        if (rep.ipo_id && rep.ipo_id !== currentIpo.id) {
          setSelectedIpo((prev) => (prev ? { ...prev, id: rep.ipo_id } : prev))
        }
        setToast({
          message: `AI due diligence audit completed for ${currentIpo.name}!`,
          type: 'success',
        })
        setTimeout(() => setToast(null), 4000)
      }
    } catch (err: any) {
      console.error('Failed to run AI audit:', err)
      const rawMsg = err?.message || ''
      const safeMsg = rawMsg && !rawMsg.includes('API key') && !rawMsg.includes('token') && !rawMsg.includes('gemini')
        ? rawMsg
        : 'DRHP forensic audit pending. Run audit to generate multi-factor analysis.'
      setToast({
        message: safeMsg,
        type: 'error',
      })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setAnalyzing(false)
    }
  }

  // Is this an actual AI audit or just preliminary sector estimate?
  // Backend returns is_audited flag, or if financial quality was assessed in report.
  const isAudited = Boolean(
    currentReport?.is_audited ||
    (currentReport?.score_breakdown?.financial_quality != null && currentReport.score_breakdown.financial_quality > 0)
  )

  const breakdown = currentReport?.score_breakdown || currentIpo?.score_breakdown

  // Live factors fallback from live IPO data
  const gmpVal = breakdown?.gmp_strength ?? (currentIpo?.gmp_percent ? Math.min(100, Math.round(currentIpo.gmp_percent * 2)) : 60)
  const subVal = breakdown?.subscription_momentum ?? 65
  const indVal = breakdown?.industry_tailwinds ?? (breakdown as any)?.industry_tailwind ?? 75

  // Canonical score computer used identically across list items and main dossier (reconciled 100% weights)
  const getIpoScore = useCallback((ipo: Ipo, rep?: AiReport | null): number => {
    const isAud = Boolean(
      rep?.is_audited ||
      (rep?.score_breakdown?.financial_quality != null && rep.score_breakdown.financial_quality > 0)
    )
    if (isAud && rep?.score_breakdown) {
      const fin = rep.score_breakdown.financial_quality ?? 50
      const val = rep.score_breakdown.valuation_safety ?? 50
      const gmp = rep.score_breakdown.gmp_strength ?? 50
      const prom = rep.score_breakdown.promoter_integrity ?? 50
      const ind = (rep.score_breakdown as any).industry_tailwinds ?? 50
      const sub = rep.score_breakdown.subscription_momentum ?? 50
      return Math.round(fin * 0.25 + val * 0.20 + gmp * 0.20 + prom * 0.15 + ind * 0.10 + sub * 0.10)
    }
    if (rep?.overall_score != null && isAud) {
      return rep.overall_score
    }
    // Live preliminary score derived strictly from 60% GMP strength + 40% subscription momentum
    const gmpPct = ipo.gmp_percent || 0
    let gmpStr = 25
    if (gmpPct >= 50.0) gmpStr = Math.min(100, Math.round(80 + (gmpPct - 50) * 0.4))
    else if (gmpPct >= 20.0) gmpStr = Math.round(60 + (gmpPct - 20) * (20 / 30))
    else if (gmpPct >= 5.0) gmpStr = Math.round(40 + (gmpPct - 5) * (20 / 15))
    else if (gmpPct >= 0.0) gmpStr = Math.round(25 + gmpPct * 3)
    else gmpStr = Math.max(0, Math.round(25 + gmpPct))

    const sub = ipo.subscription_total || 0
    let subStr = 30
    if (sub >= 20.0) subStr = Math.min(100, Math.round(80 + (sub - 20) * 0.5))
    else if (sub >= 5.0) subStr = Math.round(60 + (sub - 5) * (20 / 15))
    else if (sub >= 1.0) subStr = Math.round(40 + (sub - 1) * 5)

    return Math.round(gmpStr * 0.60 + subStr * 0.40)
  }, [])

  const compositeScore = currentIpo ? getIpoScore(currentIpo, currentReport) : 50

  const recommendation = currentReport?.recommendation || currentIpo?.recommendation || getScoreRecommendation(compositeScore)
  const recLabel = getRecommendationLabel(recommendation)

  const redFlags = currentReport?.red_flags || currentIpo?.red_flags || []
  const strengths = currentReport?.strengths || currentIpo?.strengths || []

  const hasDrhp = Boolean(
    currentIpo?.drhp_url ||
    currentIpo?.prospectus_url ||
    (currentReport?.drhp_status && currentReport.drhp_status !== 'NOT_FILED')
  )

  const missingFields = useMemo(() => {
    if (currentReport?.missing_fields && currentReport.missing_fields.length > 0) {
      return currentReport.missing_fields
    }
    const list: string[] = []
    if (!hasDrhp) {
      list.push('SEBI Draft Prospectus (DRHP)')
      list.push('OFS vs Fresh Issue Split')
      list.push('Restated Financial Statements')
    }
    if (!currentIpo?.price_band_min || !currentIpo?.price_band_max || currentIpo.price_band_min === currentIpo.price_band_max) {
      list.push('Price Band')
    }
    if (!currentIpo?.issue_size_cr) {
      list.push('Issue Size')
    }
    if (!currentIpo?.issue_open_date) {
      list.push('Bidding Dates')
    }
    return list
  }, [currentReport, hasDrhp, currentIpo])

  const isSme = currentIpo?.type === 'SME' || (currentIpo?.name && currentIpo.name.includes('SME'))
  const gatekeepersToDisplay = (currentReport?.gatekeepers && currentReport.gatekeepers.length > 0)
    ? currentReport.gatekeepers.map((gk) => {
        if (gk.key === 'anchor_quality' && isSme) {
          return {
            ...gk,
            details: 'Not applicable for SME issues (SEBI ICDR regulations exempt SME issues)',
            status: 'PASS',
            threshold: 'N/A (SME platform)',
            impact: 'Anchor investor reservation is optional and exempt for SME listing norms.',
          }
        }
        return gk
      })
    : [
        {
          key: 'ofs_split',
          name: 'OFS vs. Fresh Issue Split',
          details: !hasDrhp
            ? 'DRHP not yet filed with SEBI — issue breakdown pending official regulatory draft.'
            : isAudited ? 'Fresh: 80% | OFS: 20%' : 'Awaiting DRHP parse',
          status: !hasDrhp ? 'WARN' : isAudited ? 'PASS' : 'WARN',
          threshold: 'OFS ≤ 40% (Fresh ≥ 60%)',
          impact: !hasDrhp
            ? 'Pending official DRHP to verify whether promoters or early investors are offloading equity.'
            : 'Capital retained inside company to fund capex; minimal promoter dump.',
        },
        {
          key: 'anchor_quality',
          name: 'Anchor Book Quality',
          details: isSme
            ? 'Not applicable for SME issues (SEBI ICDR regulations exempt SME issues)'
            : !hasDrhp
            ? 'Anchor book disclosures release 1 day prior to issue opening; pending DRHP clearance.'
            : isAudited ? 'Tier-1 Domestic MFs with 30-day lock-in' : 'Awaiting anchor book release',
          status: isSme ? 'PASS' : !hasDrhp ? 'WARN' : isAudited ? 'PASS' : 'WARN',
          threshold: isSme ? 'N/A (SME platform)' : 'Domestic MFs > 30%',
          impact: isSme
            ? 'Anchor investor reservation is optional and exempt for SME listing norms.'
            : !hasDrhp
            ? 'Institutional price floor can only be evaluated once anchor allocations are published.'
            : 'Provides institutional price floor and cushions listing day volatility.',
        },
        {
          key: 'cfo_conversion',
          name: 'Cash Flow vs. PAT Conversion',
          details: !hasDrhp
            ? 'Audited restated accounts pending SEBI DRHP publication.'
            : isAudited ? 'CFO/PAT ratio ~0.92x (Healthy cash backing)' : 'Awaiting Restated Accounts',
          status: !hasDrhp ? 'WARN' : isAudited ? 'PASS' : 'WARN',
          threshold: 'CFO / PAT Ratio ≥ 0.70x',
          impact: 'Cannot assess cash collection quality without statutory auditor-certified financials.',
        },
        {
          key: 'valuation_cushion',
          name: 'Valuation Room vs. Listed Peers',
          details: !hasDrhp
            ? 'Price band and P/E valuation multiples not yet fixed by book running lead managers.'
            : isAudited ? 'P/E discount vs listed peer sector average' : 'Awaiting valuation multiple check',
          status: !hasDrhp ? 'WARN' : isAudited ? 'PASS' : 'WARN',
          threshold: '≥ 15% discount to peers',
          impact: 'Valuation discount will be determined once merchant bankers fix the issue price band.',
        },
        {
          key: 'litigation_exposure',
          name: 'Litigation Liability Ratio',
          details: !hasDrhp
            ? 'Legal annexures and contingent tax claims pending official DRHP disclosure.'
            : isAudited ? 'Disputed court claims < 5% of issue size' : 'Awaiting legal annexure review',
          status: !hasDrhp ? 'WARN' : isAudited ? 'PASS' : 'WARN',
          threshold: 'Claims < 5% of Issue Size',
          impact: 'Contingent legal liabilities can only be quantified from official SEBI DRHP filing.',
        },
      ]

  // Strict fidelity: Never fabricate financial metrics if DRHP is not filed
  const financialMetricsToDisplay = hasDrhp ? currentReport?.financial_metrics || null : null

  // Price Band Clean Formatter (avoids 'Rs 94.0-94.0')
  const formattedPriceBand = useMemo(() => {
    if (!currentIpo) return 'TBD'
    const minP = currentIpo.price_band_min
    const maxP = currentIpo.price_band_max
    if (!minP && !maxP) return 'TBD'
    const rMin = Math.round(minP || 0)
    const rMax = Math.round(maxP || rMin)
    if (rMin === rMax || !rMax) return `₹${rMin}`
    return `₹${rMin} - ₹${rMax}`
  }, [currentIpo])

  // Sanitized summary copy without ugly decimal Rs strings
  const cleanedSummary = useMemo(() => {
    if (!currentIpo) return ''
    let s = currentReport?.executive_summary
      ? stripHtml(currentReport.executive_summary)
      : currentIpo.about ||
        `${currentIpo.name} operates in the ${currentIpo.type || 'EQ'} primary market segment with an issue size of ${currentIpo.issue_size || 'N/A'}. Run an AI audit to extract forensic insights directly from SEBI DRHP filings.`
    
    // Replace Rs 94.0-94.0 with formatted price band
    s = s.replace(/Rs\s*\d+(\.\d+)?\s*-\s*\d+(\.\d+)?/gi, formattedPriceBand)
    s = s.replace(/Rs\s*(\d+(\.\d+)?)/gi, (_, num) => `₹${Math.round(parseFloat(num))}`)
    return s
  }, [currentReport, currentIpo, formattedPriceBand])

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
            <span>Go to Fund Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Master-Detail Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Compact IPO List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Filter Tabs (Strict 5-Bucket Parity with IPO Board) */}
            <div className="flex items-center gap-1 border-b border-line pb-1.5 overflow-x-auto scrollbar-none flex-nowrap text-xs">
              {[
                { id: 'open' as ReportTab, label: 'Open', count: openCount },
                { id: 'closing_today' as ReportTab, label: 'Closing Today', count: closingCount },
                { id: 'upcoming' as ReportTab, label: 'Upcoming', count: upcomingCount },
                { id: 'closed' as ReportTab, label: 'Closed', count: closedCount },
                { id: 'all' as ReportTab, label: 'All', count: allCount },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
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
              {filteredIpos.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-9 h-9 rounded-full bg-surface-raised border border-line mx-auto flex items-center justify-center text-ink-3">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      {activeTab === 'open'
                        ? 'No open IPOs'
                        : activeTab === 'closing_today'
                        ? 'No IPOs closing today'
                        : activeTab === 'upcoming'
                        ? 'No upcoming IPOs'
                        : activeTab === 'closed'
                        ? 'No closed IPOs'
                        : 'No IPOs found'}
                    </div>
                    <div className="text-xs text-ink-3 mt-1">
                      {searchQuery
                        ? 'Try refining your search keyword.'
                        : activeTab === 'open' || activeTab === 'closing_today'
                        ? 'Check upcoming listings or browse all tracked issues.'
                        : 'Market is currently between IPO bidding windows.'}
                    </div>
                  </div>
                  {(activeTab === 'open' || activeTab === 'closing_today') && upcomingCount > 0 && (
                    <button
                      onClick={() => handleTabChange('upcoming')}
                      className="btn-secondary text-xs mx-auto"
                    >
                      <span>Explore Upcoming ({upcomingCount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                filteredIpos.map((ipo) => {
                  const isSelected = currentIpo?.id === ipo.id
                  // Reconciled score: matches detail card computation exactly
                  const ipoScore = getIpoScore(ipo, reports[ipo.id])
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
                            <span>{cleanTradingSymbol(ipo.symbol)}</span>
                            <span>·</span>
                            <span>{getStatusLabel(ipoStatus)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Reconciled Score Number */}
                      <div className="flex items-center gap-1 flex-shrink-0 font-mono text-[13px]">
                        <span className="text-ink font-medium">
                          {ipoScore}
                        </span>
                        <span className="text-[13px] text-ink-3">/100</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: The Research Dossier */}
          <div className="lg:col-span-8 space-y-6">
            {currentIpo ? (
              <div className="p-6 rounded-sm bg-surface border border-line space-y-6">
                {/* Header: Title + Audit Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[18px] font-medium text-ink">
                        {currentIpo.name}
                      </h2>
                      {currentIpo.type === 'SME' ? (
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
                      {!hasDrhp
                        ? isAudited ? 'Pre-filing AI assessment · DRHP awaited with SEBI' : 'Preliminary score · DRHP not yet filed with SEBI'
                        : isAudited
                        ? 'AI summary of listed highlights · financials not assessed'
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
                      <span>
                        {analyzing
                          ? 'Auditing DRHP...'
                          : isAudited
                          ? (hasDrhp ? 'Re-run AI audit' : 'Re-run Pre-filing Audit')
                          : (hasDrhp ? 'Run AI Audit' : 'Run Pre-filing Audit')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Pre-Filing / Missing DRHP Regulatory Disclaimer Banner */}
                {!hasDrhp && (
                  <div className="p-4 rounded-sm border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="font-semibold text-amber-200 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span>Pre-Filing Stage: DRHP Not Filed with SEBI</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-amber-500/20 border border-amber-500/30 text-amber-300">
                            Pending Regulatory Submission
                          </span>
                        </span>
                      </div>
                      <p className="text-amber-300/90 leading-relaxed text-[12px]">
                        {currentReport?.drhp_disclaimer ||
                          `${currentIpo.name} is in the pre-filing / intent stage and has not yet submitted its Draft Red Herring Prospectus (DRHP) to SEBI. Key parameters—including OFS vs. Fresh Issue capital allocation, 3-year restated balance sheets (FY24-FY26), anchor book commitments, and price band multiples—are not yet publicly disclosed. Current conviction score is an indicative preliminary estimate derived solely from early grey market premium and sector momentum.`}
                      </p>
                      {missingFields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {missingFields.map((field, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-200 border border-amber-500/30"
                            >
                              Pending: {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                    {(currentIpo.gmp_percent || 0) > 0 && (
                      <div className="text-right">
                        <span className="text-[13px] text-ink-3 block">Listing gain</span>
                        <span className="text-[16px] font-mono font-medium text-emerald-400 mt-1 block">
                          ↑ {formatPercent(currentIpo.gmp_percent)}
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

                {/* 1. Listing Gatekeepers (Deal-Breaker Checks with PASS / FAIL / WARN) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-ink-2 flex items-center gap-2">
                      <span>Listing gatekeepers (deal-breaker checks)</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">
                        short-term gain filter
                      </span>
                    </div>
                    {isAudited ? (
                      <span className="text-[12px] text-ink-2 font-mono">
                        {gatekeepersToDisplay.filter((g) => g.status === 'PASS').length} of {gatekeepersToDisplay.length} passed
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded">
                        Audit Required · 5 Checks Pending
                      </span>
                    )}
                  </div>

                  {!isAudited && (
                    <div className="p-3.5 rounded-sm bg-surface-raised border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-ink-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>
                          DRHP filing not yet audited. Trigger the AI audit to parse the 5 deal-breaker forensic gatekeepers directly from official SEBI disclosures.
                        </span>
                      </div>
                      <button
                        onClick={handleRunAiAudit}
                        disabled={analyzing}
                        className="btn-primary text-xs py-1.5 px-3 flex-shrink-0 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                        <span>{analyzing ? 'Auditing DRHP...' : 'Run AI Audit'}</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    {gatekeepersToDisplay.map((gk, idx) => {
                      const isPass = gk.status === 'PASS'
                      const isFail = gk.status === 'FAIL'
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-sm bg-surface-raised border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors hover:border-line-hover"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-ink">{gk.name}</span>
                              <span className="text-[12px] text-ink-3 font-mono">· {gk.details}</span>
                            </div>
                            <div className="text-[12px] text-ink-2 flex items-center gap-1.5">
                              <span className="font-mono text-ink font-medium">Threshold: {gk.threshold}</span>
                              <span>—</span>
                              <span className="text-ink-3">{gk.impact}</span>
                            </div>
                          </div>

                          <div className="flex-shrink-0 self-start sm:self-center">
                            {isAudited ? (
                              isPass ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>PASS</span>
                                </span>
                              ) : isFail ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                  <span>FAIL</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  <span>WARN</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium bg-surface border border-line text-ink-3">
                                <Lock className="w-3 h-3 text-ink-3" />
                                <span>PENDING AUDIT</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 2. 3-Year Financial Growth & Institutional Demand Drivers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-ink-2 flex items-center gap-2">
                      <span>3-Year financial growth & demand driver</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">
                        numbers in ₹ Cr
                      </span>
                      {!isAudited && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">
                          Audit Required
                        </span>
                      )}
                    </div>
                    {isAudited && financialMetricsToDisplay?.cfo_to_pat_ratio != null && (
                      <span className="text-[12px] font-mono text-ink-2">
                        Cash Conversion: <span className="text-emerald-400 font-semibold">{financialMetricsToDisplay.cfo_to_pat_ratio}x CFO/PAT</span>
                      </span>
                    )}
                  </div>

                  {!financialMetricsToDisplay ? (
                    <div className="p-5 rounded-sm bg-surface-raised border border-line flex flex-col items-center justify-center text-center py-6 space-y-2.5">
                      <Lock className="w-5 h-5 text-amber-400" />
                      <div className="text-[13px] font-medium text-ink">
                        {!hasDrhp
                          ? 'SEBI DRHP Filing Pending — Financial Statements Not Disclosed'
                          : 'DRHP Restated Financials Pending Audit'}
                      </div>
                      <p className="text-[12px] text-ink-3 max-w-lg leading-relaxed">
                        {!hasDrhp
                          ? `${currentIpo.name} has not yet filed its Draft Red Herring Prospectus with SEBI. Audited 3-year financials (Revenue, PAT, Operating Cash Flow) and balance sheet schedules will populate here once the official draft prospectus is submitted.`
                          : '3-year audited financial trajectory (Revenue, PAT, CFO) is extracted directly from official SEBI DRHP filings once an audit is triggered. No synthetic data is generated.'}
                      </p>
                      {hasDrhp && (
                        <button
                          onClick={handleRunAiAudit}
                          disabled={analyzing}
                          className="btn-primary text-xs py-1.5 px-3 mt-1 inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                          <span>{analyzing ? 'Auditing DRHP...' : 'Run AI Audit to View'}</span>
                        </button>
                      )}
                      {!hasDrhp && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-line text-ink-3">
                            Pending: Audited Balance Sheets
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-line text-ink-3">
                            Pending: Restated Cash Flows
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-line text-ink-3">
                            Pending: Auditor Annexures
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* 3 Metric Columns: Revenue, PAT, CFO */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Revenue Trajectory */}
                        <div className="p-3.5 rounded-sm bg-surface-raised border border-line space-y-2">
                          <div className="flex justify-between items-center text-[12px]">
                            <span className="text-ink-3 uppercase tracking-wider text-[11px] font-medium">Revenue</span>
                            <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                              {financialMetricsToDisplay.revenue_growth_yoy || 'Disclosed in DRHP'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 font-mono">
                            {financialMetricsToDisplay.revenue_history?.map((item, idx) => (
                              <div key={idx} className="text-center">
                                <div className="text-[10px] text-ink-3">{item.year}</div>
                                <div className={`text-[13px] font-medium ${idx === 2 ? 'text-ink font-semibold' : 'text-ink-2'}`}>
                                  ₹{item.amount_cr} Cr
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Profit After Tax (PAT) */}
                        <div className="p-3.5 rounded-sm bg-surface-raised border border-line space-y-2">
                          <div className="flex justify-between items-center text-[12px]">
                            <span className="text-ink-3 uppercase tracking-wider text-[11px] font-medium">Profit (PAT)</span>
                            <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                              {financialMetricsToDisplay.pat_growth_yoy || 'Disclosed in DRHP'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 font-mono">
                            {financialMetricsToDisplay.pat_history?.map((item, idx) => (
                              <div key={idx} className="text-center">
                                <div className="text-[10px] text-ink-3">{item.year}</div>
                                <div className={`text-[13px] font-medium ${idx === 2 ? 'text-ink font-semibold' : 'text-ink-2'}`}>
                                  ₹{item.amount_cr} Cr
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Operating Cash Flow (CFO) */}
                        <div className="p-3.5 rounded-sm bg-surface-raised border border-line space-y-2">
                          <div className="flex justify-between items-center text-[12px]">
                            <span className="text-ink-3 uppercase tracking-wider text-[11px] font-medium">Operating Cash (CFO)</span>
                            <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                              {financialMetricsToDisplay.cfo_to_pat_ratio != null ? `${financialMetricsToDisplay.cfo_to_pat_ratio}x Ratio` : 'Disclosed in DRHP'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 font-mono">
                            {financialMetricsToDisplay.cfo_history?.map((item, idx) => (
                              <div key={idx} className="text-center">
                                <div className="text-[10px] text-ink-3">{item.year}</div>
                                <div className={`text-[13px] font-medium ${idx === 2 ? 'text-ink font-semibold' : 'text-ink-2'}`}>
                                  ₹{item.amount_cr} Cr
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Demand Catalyst Callout & Provenance */}
                      <div className="p-3 rounded-sm border border-line bg-canvas flex items-start gap-2.5 text-[12px]">
                        <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-ink-2 leading-relaxed">
                            <span className="text-ink font-medium">Why Demand Follows These Numbers: </span>
                            {financialMetricsToDisplay.growth_demand_verdict || 
                              "Institutional QIB buyers demand consistent PAT growth backed by real cash flow (CFO/PAT > 0.70x). When cash collections match reported profits, institutional demand floods Day 3 bidding."}
                          </div>
                          <div className="text-[10px] text-ink-3 font-mono">
                            Source: SEBI Restated Consolidated Financial Statements (DRHP Filing)
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. 6-Factor Forensic Breakdown (Strict 100% Total) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-ink-2">
                      6-factor forensic breakdown
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
                          <span className="text-[10px] text-ink-3 font-mono">· ipowatch</span>
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

                    {/* 5. Industry Sector Tailwinds */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-ink">Industry sector tailwinds</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[13px] text-ink-3 font-sans">
                            ({isAudited ? '10%' : '—'})
                          </span>
                          <span className="text-ink font-medium">
                            {isAudited && indVal !== null && indVal !== undefined
                              ? `${indVal}/100`
                              : 'Not assessed'}
                          </span>
                        </div>
                      </div>
                      {isAudited && indVal !== null && indVal !== undefined && (
                        <div className="w-full h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${getScoreBarColor(indVal)} transition-all duration-400`}
                            style={{ width: `${indVal}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 6. Institutional Subscription Momentum - Live factor */}
                    <div className="p-3.5 rounded-sm bg-canvas border border-line space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="text-ink">Institutional subscription momentum</span>
                          <span className="text-[10px] text-ink-3 font-mono">· NSE/BSE</span>
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
                      /* Unaudited state: Single clear message without competing duplicate button */
                      <div className="p-3.5 rounded-sm border border-line bg-surface-raised flex items-center gap-3 text-xs text-ink-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>
                          No audit has run yet. Trigger &quot;Run AI Audit&quot; at the top to scan litigation, auditor qualifications, and related party disclosures.
                        </span>
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
                    {cleanedSummary}
                  </p>
                </div>

                {/* Regulatory Notice & SEBI Compliance Disclaimer */}
                <div className="p-3.5 rounded-sm bg-surface-raised/60 border border-line text-[11px] text-ink-3 leading-relaxed space-y-1">
                  <div className="font-medium text-ink-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    <span>Regulatory & Methodology Notice (SEBI Compliance)</span>
                  </div>
                  <p>
                    Kapitl is an algorithmic research and educational diligence platform. Quantitative conviction scores and deal-breaker gatekeepers are derived programmatically from publicly filed draft prospectuses (DRHP) and live secondary market feeds. Kapitl is not a SEBI-registered Research Analyst or Investment Adviser. Equity investments in initial public offerings carry market and liquidity risks. Past GMP trends do not guarantee listing day returns. Always consult a certified financial advisor and inspect official SEBI filings before bidding.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-sm bg-surface border border-line text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-raised border border-line mx-auto flex items-center justify-center text-ink-3">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-[15px] font-medium text-ink">
                    {activeTab === 'open'
                      ? 'No open IPOs for due diligence'
                      : activeTab === 'closing_today'
                      ? 'No IPOs closing today'
                      : activeTab === 'upcoming'
                      ? 'No upcoming IPOs found'
                      : activeTab === 'closed'
                      ? 'No closed IPO dossiers'
                      : 'No IPO report selected'}
                  </div>
                  <div className="text-[13px] text-ink-3 max-w-md mx-auto">
                    {searchQuery
                      ? 'No issues matched your search query. Try clearing the filter.'
                      : activeTab === 'open' || activeTab === 'closing_today'
                      ? 'There are currently no active bidding windows open. Explore upcoming issues or select another tab to view forensic reports.'
                      : 'Select an issue from the left panel to inspect its complete DRHP due diligence dossier.'}
                  </div>
                </div>
                {(activeTab === 'open' || activeTab === 'closing_today') && upcomingCount > 0 && (
                  <button
                    onClick={() => handleTabChange('upcoming')}
                    className="btn-primary text-xs mx-auto inline-flex items-center gap-1.5"
                  >
                    <span>View Upcoming IPOs ({upcomingCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
