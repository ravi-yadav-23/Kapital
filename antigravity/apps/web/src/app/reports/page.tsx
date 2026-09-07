'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { Ipo, FamilyAccount } from '@/types'
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
  Download,
  Send,
  CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'

export default function ReportsPage() {
  const [ipos, setIpos] = useState<Ipo[]>([])
  const [accounts, setAccounts] = useState<FamilyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIpo, setSelectedIpo] = useState<Ipo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRec, setFilterRec] = useState<string>('ALL')
  const [isApplyOpen, setIsApplyOpen] = useState(false)
  const [copiedToast, setCopiedToast] = useState(false)

  useEffect(() => {
    Promise.all([apiClient.getIpos(), apiClient.getAccounts()]).then(([allIpos, allAccs]) => {
      setIpos(allIpos)
      setAccounts(allAccs)
      const analyzed = allIpos.filter((ipo) => ipo.score_breakdown)
      if (analyzed.length > 0) {
        setSelectedIpo(analyzed[0])
      } else if (allIpos.length > 0) {
        setSelectedIpo(allIpos[0])
      }
      setLoading(false)
    })
  }, [])

  const analyzedIpos = useMemo(() => ipos.filter((ipo) => ipo.score_breakdown || ipo.score), [ipos])

  const filteredIpos = useMemo(() => {
    return analyzedIpos.filter((ipo) => {
      if (filterRec !== 'ALL' && ipo.recommendation !== filterRec) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = ipo.name.toLowerCase().includes(q)
        const matchSymbol = ipo.symbol.toLowerCase().includes(q)
        if (!matchName && !matchSymbol) return false
      }
      return true
    })
  }, [analyzedIpos, filterRec, searchQuery])

  const handleShare = () => {
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
  }

  const isClosed =
    selectedIpo &&
    (selectedIpo.status === 'closed' ||
      selectedIpo.status === 'allotted' ||
      selectedIpo.status === 'listed')

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
                Automated Claude DRHP breakdown, red flag audits, and Gemini sentiment analysis
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
                Automated Claude DRHP breakdown, red flag audits, and Gemini sentiment analysis
              </p>
            </div>
          </div>
          <div className="p-12 text-center rounded-xl bg-surface-elevated/40 border border-border-subtle flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-to/10 border border-brand-to/20 flex items-center justify-center text-brand-to mb-1">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-text-primary">No IPO Reports Available</p>
            <p className="text-xs text-text-muted max-w-md">
              AI due diligence reports will be automatically synthesized and scored across DRHP filings as new IPOs are tracked.
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
              Automated Claude DRHP breakdown, red flag audits, and Gemini sentiment analysis
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            {/* Recommendation Quick Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs font-semibold">
              {['ALL', 'STRONG_APPLY', 'MODERATE_APPLY', 'WATCH'].map((rec) => (
                <button
                  key={rec}
                  onClick={() => setFilterRec(rec)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterRec === rec
                      ? 'bg-brand-from/15 text-brand-from border border-brand-from/30'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {rec === 'ALL' ? 'All' : rec.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* List of Reports */}
            <div className="space-y-2.5">
              {filteredIpos.map((ipo) => {
                const isSelected = selectedIpo.id === ipo.id
                return (
                  <div
                    key={ipo.id}
                    onClick={() => setSelectedIpo(ipo)}
                    className={`card p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-from bg-brand-from/5 shadow-md shadow-brand-from/5'
                        : 'border-border-subtle hover:border-brand-from/30 hover:bg-surface-elevated/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-text-primary truncate">
                          {ipo.name}
                        </h4>
                        <span className="text-2xs text-text-muted block mt-0.5">
                          {ipo.symbol} • {formatDate(ipo.issue_open_date)}
                        </span>
                      </div>

                      <ScoreBadge score={ipo.score} size="sm" />
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
                    Generated at: {formatDate(selectedIpo.scored_at)} • Version: 1.0.0
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-elevated border border-border-subtle">
                    <span className="text-2xs text-text-muted uppercase font-semibold">VERDICT:</span>
                    <span className="text-xs font-bold text-text-primary">
                      {selectedIpo.recommendation?.replace('_', ' ')}
                    </span>
                    <ScoreBadge score={selectedIpo.score} />
                  </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IpoScoreRadar breakdown={selectedIpo.score_breakdown} score={selectedIpo.score} />
                <IpoScoreBreakdown breakdown={selectedIpo.score_breakdown} />
              </div>

              {/* Red Flag Audit Report */}
              <RedFlagList redFlags={selectedIpo.red_flags} />

              {/* Executive Summary */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-from" />
                  <span>Executive Summary</span>
                </h3>
                <p className="text-text-secondary leading-relaxed bg-surface-elevated/40 p-3.5 rounded-xl border border-border-subtle">
                  {selectedIpo.about}
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
                    {selectedIpo.strengths.map((s, i) => (
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
                    {selectedIpo.risks.map((r, i) => (
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