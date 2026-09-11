'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount, AiReport } from '@/types'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { IpoScoreRadar } from '@/components/ipo/IpoScoreRadar'
import { IpoScoreBreakdown } from '@/components/ipo/IpoScoreBreakdown'
import { RedFlagList } from '@/components/ipo/RedFlagList'
import { ApplyModal } from '@/components/ipo/ApplyModal'
import {
  FileText,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  Search,
  Share2,
  Send,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'

export default function ReportsPage() {
  const [ipos, setIpos] = useState<Ipo[]>([])
  const [reports, setReports] = useState<Record<string, AiReport>>({})
  const [accounts, setAccounts] = useState<FamilyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIpo, setSelectedIpo] = useState<Ipo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE') // 'ACTIVE', 'UPCOMING', 'ALL'
  const [filterRec, setFilterRec] = useState<string>('ALL')
  const [isApplyOpen, setIsApplyOpen] = useState(false)
  const [copiedToast, setCopiedToast] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const loadData = async () => {
    try {
      const [allIpos, allReports, allAccs] = await Promise.all([
        apiClient.getIpos(),
        apiClient.getReports(),
        apiClient.getAccounts(),
      ])
      setIpos(allIpos)
      setAccounts(allAccs)

      const repMap: Record<string, AiReport> = {}
      allReports.forEach((r) => {
        if (r.ipo_id) repMap[r.ipo_id] = r
      })
      setReports(repMap)

      if (allIpos.length > 0) {
        const activeFirst =
          allIpos.find((i) => i.status === 'open' || i.status === 'closing_today') ||
          allIpos.find((i) => i.status === 'upcoming') ||
          allIpos[0]
        setSelectedIpo(activeFirst)
        if (!repMap[activeFirst.id]) {
          apiClient.getReportById(activeFirst.id).then((rep) => {
            if (rep) {
              setReports((prev) => ({ ...prev, [activeFirst.id]: rep }))
            }
          }).catch((err) => console.warn('Could not load report for first IPO:', err))
        }
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
        console.error('Failed to fetch report for ipo:', err)
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
      }
    } catch (err) {
      console.error('Failed to generate AI due diligence report:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSyncMarketIpos = async () => {
    setSyncing(true)
    try {
      await apiClient.syncIpos()
      await loadData()
    } catch (err) {
      console.error('Failed to sync market IPOs:', err)
    } finally {
      setSyncing(false)
    }
  }

  const filteredIpos = useMemo(() => {
    return ipos.filter((ipo) => {
      // Status filter
      if (filterStatus === 'ACTIVE') {
        if (ipo.status !== 'open' && ipo.status !== 'closing_today') return false
      } else if (filterStatus === 'UPCOMING') {
        if (ipo.status !== 'upcoming') return false
      }

      // Recommendation filter
      const rep = reports[ipo.id]
      const rec = rep?.recommendation || ipo.recommendation
      if (filterRec !== 'ALL' && rec !== filterRec) return false

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = ipo.name.toLowerCase().includes(q)
        const matchSymbol = ipo.symbol.toLowerCase().includes(q)
        if (!matchName && !matchSymbol) return false
      }
      return true
    })
  }, [ipos, reports, filterStatus, filterRec, searchQuery])

  const handleShare = () => {
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
  }

  const isClosed =
    selectedIpo &&
    (selectedIpo.status === 'closed' ||
      selectedIpo.status === 'allotted' ||
      selectedIpo.status === 'listed')

  const activeScore = currentReport?.overall_score ?? selectedIpo?.score ?? 50
  const activeVerdict = currentReport?.recommendation ?? selectedIpo?.recommendation ?? 'WATCH'

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="page-header">
            <div>
              <h1 className="page-title flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-brand-to" />
                <span>AI Due Diligence & Research Reports</span>
              </h1>
              <p className="page-subtitle">
                Autonomous multi-agent forensic analysis, red flag audits, and SEBI allocation strategy
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card h-96 skeleton" />
            <div className="card h-96 skeleton lg:col-span-2" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!selectedIpo || ipos.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="page-header">
            <div>
              <h1 className="page-title flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-brand-to" />
                <span>AI Due Diligence & Research Reports</span>
              </h1>
              <p className="page-subtitle">
                Autonomous multi-agent forensic analysis, red flag audits, and SEBI allocation strategy
              </p>
            </div>
            <button
              onClick={handleSyncMarketIpos}
              disabled={syncing}
              className="btn btn-secondary btn-sm gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Market IPOs'}</span>
            </button>
          </div>
          <div className="p-12 text-center rounded-xl bg-surface-elevated/40 border border-border-subtle flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-to/10 border border-brand-to/20 flex items-center justify-center text-brand-to mb-1">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-text-primary">No IPO Reports Available</p>
            <p className="text-xs text-text-muted max-w-md">
              Click &quot;Sync Market IPOs&quot; to fetch the latest Indian market issues and trigger autonomous multi-agent analysis.
            </p>
          </div>
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
              <FileText className="w-5 h-5 text-brand-to" />
              <span>AI Due Diligence & Research Reports</span>
            </h1>
            <p className="page-subtitle">
              Autonomous multi-agent forensic analysis, red flag audits, and SEBI allocation strategy
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSyncMarketIpos}
              disabled={syncing}
              className="btn btn-ghost btn-sm gap-1.5 text-xs text-text-secondary border border-border-subtle hover:bg-surface-elevated"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Live Market'}</span>
            </button>

            <button
              onClick={handleShare}
              className="btn btn-ghost btn-sm gap-1.5 text-xs text-text-secondary"
            >
              {copiedToast ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                  <span className="text-accent-green">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel: Report Selection List */}
          <div className="space-y-3 lg:col-span-1">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search IPO report..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-elevated border border-border-subtle rounded-lg"
              />
            </div>

            {/* Status Tabs: Active vs Upcoming vs All */}
            <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg border border-border-subtle text-xs font-semibold">
              {[
                { id: 'ACTIVE', label: 'Live Active' },
                { id: 'UPCOMING', label: 'Upcoming' },
                { id: 'ALL', label: 'All Issues' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterStatus(tab.id)
                    const matches = ipos.filter((i) => {
                      if (tab.id === 'ACTIVE') return i.status === 'open' || i.status === 'closing_today'
                      if (tab.id === 'UPCOMING') return i.status === 'upcoming'
                      return true
                    })
                    if (matches.length > 0) handleSelectIpo(matches[0])
                  }}
                  className={`flex-1 py-1 text-center rounded-md transition-all text-2xs ${
                    filterStatus === tab.id
                      ? 'bg-brand-from text-white shadow-sm font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recommendation Quick Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs font-semibold">
              {['ALL', 'STRONG_APPLY', 'MODERATE_APPLY', 'WATCH', 'AVOID'].map((rec) => (
                <button
                  key={rec}
                  onClick={() => setFilterRec(rec)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterRec === rec
                      ? 'bg-brand-from/15 text-brand-from border border-brand-from/30 font-bold'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {rec === 'ALL' ? 'All Verdicts' : rec.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* List of Reports */}
            <div className="space-y-2.5">
              {filteredIpos.map((ipo) => {
                const isSelected = selectedIpo.id === ipo.id
                const rep = reports[ipo.id]
                const itemScore = rep?.overall_score ?? ipo.score

                const statusColor =
                  ipo.status === 'open'
                    ? 'bg-accent-green/15 text-accent-green border-accent-green/30'
                    : ipo.status === 'closing_today'
                    ? 'bg-accent-amber/15 text-accent-amber border-accent-amber/30'
                    : ipo.status === 'upcoming'
                    ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                    : 'bg-surface-elevated text-text-muted border-border-subtle'

                return (
                  <div
                    key={ipo.id}
                    onClick={() => handleSelectIpo(ipo)}
                    className={`card p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-from bg-brand-from/5 shadow-md shadow-brand-from/5'
                        : 'border-border-subtle hover:border-brand-from/30 hover:bg-surface-elevated/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-3xs font-mono font-bold uppercase tracking-wider border ${statusColor}`}
                          >
                            {ipo.status === 'closing_today' ? 'Closing Today' : ipo.status}
                          </span>
                          {ipo.gmp_percent && ipo.gmp_percent > 0 ? (
                            <span className="text-3xs font-mono font-semibold text-accent-green">
                              GMP +{ipo.gmp_percent}%
                            </span>
                          ) : null}
                        </div>
                        <h4 className="font-bold text-xs text-text-primary truncate">
                          {ipo.name}
                        </h4>
                        <span className="text-2xs text-text-muted block mt-0.5">
                          {ipo.symbol} • {formatDate(ipo.issue_open_date || ipo.issue_close_date)}
                        </span>
                      </div>

                      <ScoreBadge score={itemScore} size="sm" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Panel: Report Viewer */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-6 space-y-6 bg-surface-card border-border-default">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-brand-from" />
                    <h2 className="text-lg font-bold text-text-primary">
                      {selectedIpo.name} Due Diligence Report
                    </h2>
                  </div>
                  <span className="text-2xs text-text-muted mt-0.5 block">
                    Generated at: {formatDate(currentReport?.scored_at || selectedIpo.scored_at)} • Version: 2.0.0
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-elevated border border-border-subtle">
                    <span className="text-2xs text-text-muted uppercase font-semibold">VERDICT:</span>
                    <span className="text-xs font-bold text-text-primary">
                      {activeVerdict.replace('_', ' ')}
                    </span>
                    <ScoreBadge score={activeScore} />
                  </div>

                  <button
                    onClick={handleRunAiAudit}
                    disabled={analyzing}
                    className="btn btn-secondary btn-sm gap-1.5 border border-border-subtle"
                    title="Execute autonomous multi-agent analysis (Financial, Sentiment, Allocation)"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin text-brand-from' : ''}`} />
                    <span>{analyzing ? 'Analyzing...' : 'Run AI Audit'}</span>
                  </button>

                  {!isClosed && (
                    <button
                      onClick={() => setIsApplyOpen(true)}
                      className="btn btn-primary btn-sm gap-1.5 shadow-md shadow-brand-from/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Apply Now</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Score Radar & Dimension Bars */}
              {currentReport?.score_breakdown ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <IpoScoreRadar breakdown={currentReport.score_breakdown} score={activeScore} />
                  <IpoScoreBreakdown breakdown={currentReport.score_breakdown} />
                </div>
              ) : (
                <div className="p-6 bg-surface-elevated/40 rounded-xl border border-border-subtle text-center space-y-2">
                  <p className="text-xs text-text-muted">
                    No multi-agent score breakdown generated yet for this issue.
                  </p>
                  <button
                    onClick={handleRunAiAudit}
                    disabled={analyzing}
                    className="btn btn-primary btn-xs gap-1.5 mt-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{analyzing ? 'Generating Multi-Agent Audit...' : 'Generate 6-Dimension Audit'}</span>
                  </button>
                </div>
              )}

              {/* Red Flag Audit Report */}
              <RedFlagList redFlags={currentReport?.red_flags || []} />

              {/* Executive Summary */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-from" />
                  <span>Executive Summary</span>
                </h3>
                <p className="text-text-secondary leading-relaxed bg-surface-elevated/40 p-3.5 rounded-xl border border-border-subtle">
                  {currentReport?.executive_summary || selectedIpo.about || 'Awaiting multi-agent due diligence audit.'}
                </p>
              </div>

              {/* Financial and Operating Strengths */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent-green" />
                  <span>Financial and Operating Strengths</span>
                </h3>
                <div className="p-3.5 rounded-xl border border-border-subtle space-y-2 bg-surface-elevated/20">
                  <ul className="space-y-1.5 text-text-secondary list-disc list-inside">
                    {(currentReport?.strengths?.length ? currentReport.strengths : selectedIpo.strengths || []).map((s, i) => (
                      <li key={i} className="leading-relaxed">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Risks & Watchlist */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-text-primary flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-accent-amber" />
                  <span>Key Risks & Watchlist</span>
                </h3>
                <div className="p-3.5 rounded-xl border border-border-subtle space-y-2 bg-surface-elevated/20">
                  <ul className="space-y-1.5 text-text-secondary list-disc list-inside">
                    {(currentReport?.risks?.length ? currentReport.risks : selectedIpo.risks || []).map((r, i) => (
                      <li key={i} className="leading-relaxed">{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Apply Modal */}
        {selectedIpo && (
          <ApplyModal
            ipo={selectedIpo}
            accounts={accounts}
            isOpen={isApplyOpen}
            onClose={() => setIsApplyOpen(false)}
          />
        )}
      </div>
    </DashboardLayout>
  )
}