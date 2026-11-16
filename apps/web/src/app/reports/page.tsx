'use client'

import { ListingGainPanel } from '@/components/reports/ListingGainPanel'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient, canShowMockIpos } from '@/lib/api-client'
import { Ipo, AiReport } from '@/types'
import { MOCK_IPOS, MOCK_REPORTS } from '@/lib/mock-data'
import {
  formatRelativeDate,
  computeIpoStatus,
  getCompanyAvatarProps,
  getStatusDotClass,
  getStatusLabel,
  cleanTradingSymbol,
} from '@/lib/formatters'
import {
  Search,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import { stripHtml } from '@/lib/utils'

export default function ReportsPage() {
  const [ipos, setIpos] = useState<Ipo[]>(() => {
    const cached = apiClient.getCachedIpos()
    return cached && cached.length > 0 ? cached : canShowMockIpos() ? MOCK_IPOS : []
  })
  const [reports, setReports] = useState<Record<string, AiReport>>(() => {
    const repMap: Record<string, AiReport> = {}
    if (canShowMockIpos()) {
      MOCK_REPORTS.forEach((r) => {
        if (r.ipo_id) repMap[r.ipo_id] = r
      })
    }
    return repMap
  })
  const [loading, setLoading] = useState(false)
  const [selectedIpo, setSelectedIpo] = useState<Ipo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  // Is this an actual AI audit or just preliminary sector estimate?
  // Backend returns is_audited flag, or if financial quality was assessed in report.
  const isAudited = Boolean(
    currentReport?.is_audited ||
    (currentReport?.score_breakdown?.financial_quality != null && currentReport.score_breakdown.financial_quality > 0)
  )


  // The frontend never computes a score: it shows the engine score the API returns (null = "No score yet").
  const getIpoScore = useCallback((ipo: Ipo): number | null => ipo.score ?? null, [])

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
      : currentIpo.about || ''
    
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
            Every IPO’s listing-gain score, the reasons behind it and the company facts it rests on
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
                  const ipoScore = getIpoScore(ipo)
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
                          {ipoScore ?? '—'}
                        </span>
                        {ipoScore !== null && <span className="text-[13px] text-ink-3">/100</span>}
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
                {/* Header: name, type and schedule. The single action (Run audit) lives in the analysis panel. */}
                <div className="flex flex-col gap-1 border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-medium text-ink">{currentIpo.name}</h2>
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
                  <div className="text-[13px] text-ink-2">
                    {getStatusLabel(computeIpoStatus(currentIpo.issue_open_date, currentIpo.issue_close_date, undefined, currentIpo.status, currentIpo.allotment_date))} · Price band {formattedPriceBand === 'TBD' ? 'TBA' : formattedPriceBand}
                    {currentIpo.issue_open_date ? ` · opens ${formatRelativeDate(currentIpo.issue_open_date)}` : ' · dates TBA'}
                  </div>
                </div>

                {/* No offer document yet: say so plainly */}
                {!hasDrhp && (
                  <div className="p-4 rounded-sm border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="font-semibold text-amber-200">No offer document link yet</div>
                      <p className="text-amber-300/90 leading-relaxed text-[12px]">
                        {currentReport?.drhp_disclaimer ||
                          `We have no DRHP / RHP link for ${currentIpo.name} yet. Until one is found, company facts come from a summary or are unknown, and the score says which.`}
                      </p>
                      {missingFields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {missingFields.map((field, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-200 border border-amber-500/30">
                              Missing: {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* The listing-gain verdict: same score as every other screen, its reasons, components, red flags and facts */}
                <ListingGainPanel ipoId={currentIpo.id} detailed />

                {/* Financial history, only when an earlier audit really extracted it */}
                {isAudited && financialMetricsToDisplay && (
                  <div className="space-y-3">
                    <div className="text-[13px] font-medium text-ink-2 flex items-center gap-2">
                      <span>Financial history</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3 font-mono">₹ cr</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        ['Revenue', financialMetricsToDisplay.revenue_history, financialMetricsToDisplay.revenue_growth_yoy],
                        ['Profit (PAT)', financialMetricsToDisplay.pat_history, financialMetricsToDisplay.pat_growth_yoy],
                        ['Operating cash (CFO)', financialMetricsToDisplay.cfo_history, financialMetricsToDisplay.cfo_to_pat_ratio != null ? `${financialMetricsToDisplay.cfo_to_pat_ratio}x of PAT` : null],
                      ] as const).map(([label, history, note]) => (
                        <div key={label} className="p-3.5 rounded-sm bg-surface-raised border border-line space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-ink-3 uppercase tracking-wider text-[11px] font-medium">{label}</span>
                            {note && <span className="text-ink-2 font-mono text-[11px]">{note}</span>}
                          </div>
                          <div className="flex items-baseline justify-between pt-1 font-mono">
                            {(history ?? []).map((item, idx) => (
                              <div key={idx} className="text-center">
                                <div className="text-[10px] text-ink-3">{item.year}</div>
                                <div className="text-[13px] font-medium text-ink-2">₹{item.amount_cr}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* About the company (from the stored report or the source feed) */}
                {cleanedSummary && <div className="space-y-2 border-t border-line pt-4">
                  <div className="text-[13px] font-medium text-ink-2">
                    About the company
                  </div>
                  <p className="text-[13px] text-ink-2 leading-relaxed">
                    {cleanedSummary}
                  </p>
                </div>}

                {/* Regulatory Notice & SEBI Compliance Disclaimer */}
                <div className="p-3.5 rounded-sm bg-surface-raised/60 border border-line text-[11px] text-ink-3 leading-relaxed space-y-1">
                  <div className="font-medium text-ink-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    <span>Regulatory & Methodology Notice (SEBI Compliance)</span>
                  </div>
                  <p>
                    Kapitl is an algorithmic research and educational diligence platform. Scores are calculated by a fixed formula from public market data and facts read from SEBI offer documents (DRHP / RHP). Kapitl is not a SEBI-registered Research Analyst or Investment Adviser. Equity investments in initial public offerings carry market and liquidity risks. Past GMP trends do not guarantee listing day returns. Always consult a certified financial advisor and inspect official SEBI filings before bidding.
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
