'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Ipo, FamilyAccount } from '@/types'
import { IpoCard } from './IpoCard'
import {
  formatINR,
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
  Filter,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  Search,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'

interface IpoBoardProps {
  ipos: Ipo[]
  accounts?: FamilyAccount[]
  maxItemsPerTab?: number
  showViewAll?: boolean
  showFilters?: boolean
}

type TabType = 'open' | 'closing_today' | 'upcoming' | 'closed' | 'all'

export function IpoBoard({
  ipos,
  accounts = [],
  maxItemsPerTab,
  showViewAll = false,
  showFilters = true,
}: IpoBoardProps) {
  // Canonical status computation across all IPO items
  const canonicalIpos = useMemo(
    () =>
      ipos.map((i) => ({
        ...i,
        status: computeIpoStatus(i.issue_open_date, i.issue_close_date),
      })),
    [ipos]
  )

  // Tab counts
  const openCount = useMemo(() => canonicalIpos.filter((i) => i.status === 'open').length, [canonicalIpos])
  const closingCount = useMemo(() => canonicalIpos.filter((i) => i.status === 'closing_today').length, [canonicalIpos])
  const upcomingCount = useMemo(() => canonicalIpos.filter((i) => i.status === 'upcoming').length, [canonicalIpos])
  const closedCount = useMemo(
    () => canonicalIpos.filter((i) => i.status === 'closed').length,
    [canonicalIpos]
  )
  const allCount = canonicalIpos.length

  // Smart default tab: default to first non-empty tab among Open, Closing Today, Upcoming, All
  const initialTab: TabType = useMemo(() => {
    if (openCount > 0) return 'open'
    if (closingCount > 0) return 'closing_today'
    if (upcomingCount > 0) return 'upcoming'
    return 'all'
  }, [openCount, closingCount, upcomingCount])

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [minScore, setMinScore] = useState<number>(0)
  const [maxInvestment, setMaxInvestment] = useState<number>(200000)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Sync active tab if initial data arrives late
  useEffect(() => {
    if (openCount === 0 && closingCount === 0 && upcomingCount > 0 && activeTab === 'open') {
      setActiveTab('upcoming')
    }
  }, [openCount, closingCount, upcomingCount, activeTab])

  // Filtered list based on active tab and filter controls
  const filteredIpos = useMemo(() => {
    return canonicalIpos.filter((ipo) => {
      // 1. Status Tab filter
      if (activeTab === 'open' && ipo.status !== 'open') return false
      if (activeTab === 'closing_today' && ipo.status !== 'closing_today') return false
      if (activeTab === 'upcoming' && ipo.status !== 'upcoming') return false
      if (activeTab === 'closed' && ipo.status !== 'closed') return false

      // 2. Type filter
      if (selectedType !== 'ALL' && ipo.type !== selectedType) return false

      // 3. Score filter
      if (ipo.score !== undefined && ipo.score < minScore) return false

      // 4. Min Investment filter
      if (ipo.min_investment > maxInvestment) return false

      // 5. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = ipo.name.toLowerCase().includes(q)
        const matchSymbol = ipo.symbol.toLowerCase().includes(q)
        if (!matchName && !matchSymbol) return false
      }

      return true
    })
  }, [canonicalIpos, activeTab, selectedType, minScore, maxInvestment, searchQuery])

  const displayList = maxItemsPerTab ? filteredIpos.slice(0, maxItemsPerTab) : filteredIpos

  const handleResetFilters = () => {
    setSelectedType('ALL')
    setMinScore(0)
    setMaxInvestment(200000)
    setSearchQuery('')
  }

  const isFiltered =
    selectedType !== 'ALL' || minScore > 0 || maxInvestment < 200000 || searchQuery.trim() !== ''

  return (
    <div className="space-y-4">
      {/* ── 1. Underline Tab Navigation & Controls Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-px">
        {/* Underline Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'open', label: 'Open', count: openCount },
            { id: 'closing_today', label: 'Closing Today', count: closingCount },
            { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { id: 'closed', label: 'Closed', count: closedCount },
            { id: 'all', label: 'All', count: allCount },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`tab-item ${isActive ? 'tab-item-active' : ''}`}
              >
                <span>{tab.label}</span>
                <span className="text-2xs font-mono text-ink-3">({tab.count})</span>
              </button>
            )
          })}
        </div>

        {/* View Toggle & Filter Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto pb-1 sm:pb-0">
          {showFilters && (
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`btn-secondary h-7 px-2.5 text-xs flex items-center gap-1.5 ${
                isFiltersOpen || isFiltered ? 'bg-surface-selected text-ink border-line-strong' : ''
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
            </button>
          )}

          {/* Table / Cards toggle */}
          <div className="flex items-center rounded-sm border border-line bg-surface p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded-sm text-ink-2 hover:text-ink transition-colors ${
                viewMode === 'table' ? 'bg-surface-raised text-ink' : ''
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1 rounded-sm text-ink-2 hover:text-ink transition-colors ${
                viewMode === 'cards' ? 'bg-surface-raised text-ink' : ''
              }`}
              title="Cards view"
              aria-label="Cards view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Collapsible Filters Bar ── */}
      {isFiltersOpen && (
        <div className="p-4 rounded-sm bg-surface border border-line space-y-3 animate-fade-in text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-2xs text-ink-2">Search Issue</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Swiggy, Tonbo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-canvas border border-line rounded-sm text-ink"
                />
              </div>
            </div>

            {/* Issue Type */}
            <div className="space-y-1">
              <label className="text-2xs text-ink-2">Issue Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-canvas border border-line rounded-sm text-ink"
              >
                <option value="ALL">All Types</option>
                <option value="EQ">Mainboard (EQ)</option>
                <option value="SME">SME</option>
                <option value="REIT">REIT / InvIT</option>
              </select>
            </div>

            {/* Min Score */}
            <div className="space-y-1">
              <div className="flex justify-between text-2xs text-ink-2">
                <span>Min AI Score</span>
                <span className="font-mono">{minScore}/100</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-[#f5a623] cursor-pointer"
              />
            </div>

            {/* Max Investment (Indian Format) */}
            <div className="space-y-1">
              <div className="flex justify-between text-2xs text-ink-2">
                <span>Max Investment</span>
                <span className="font-mono" suppressHydrationWarning>{formatINR(maxInvestment)}</span>
              </div>
              <input
                type="range"
                min={15000}
                max={200000}
                step={5000}
                value={maxInvestment}
                onChange={(e) => setMaxInvestment(Number(e.target.value))}
                className="w-full accent-[#f5a623] cursor-pointer"
              />
            </div>
          </div>

          {isFiltered && (
            <div className="flex justify-end pt-1">
              <button
                onClick={handleResetFilters}
                className="text-xs text-ink-2 hover:text-ink flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all filters</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Content Display: Table or Cards ── */}
      {displayList.length === 0 ? (
        <div className="p-12 rounded-sm bg-surface border border-line text-center space-y-3">
          <div className="text-sm font-medium text-ink">
            {isFiltered ? 'No issues matched your active filters' : `No ${activeTab.replace('_', ' ')} IPOs right now`}
          </div>
          <p className="text-xs text-ink-2 max-w-sm mx-auto">
            {isFiltered
              ? 'Try widening your price band, score slider, or clearing the search query.'
              : activeTab === 'open'
              ? 'Bidding is currently closed for the day. Switch to Upcoming to see scheduled issues.'
              : 'New primary market issues will populate here as draft red herring prospectuses are filed.'}
          </p>
          {isFiltered ? (
            <button onClick={handleResetFilters} className="btn-secondary text-xs">
              Clear filters
            </button>
          ) : activeTab === 'open' && upcomingCount > 0 ? (
            <button onClick={() => setActiveTab('upcoming')} className="btn-secondary text-xs">
              View Upcoming Issues ({upcomingCount}) →
            </button>
          ) : null}
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-sm border border-line bg-surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Status</th>
                <th>Bidding Window</th>
                <th className="th-num">Price Band</th>
                <th className="th-num">Min Invest</th>
                <th className="th-num">GMP</th>
                <th>Score</th>
                <th>Verdict</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((ipo) => {
                const score = ipo.score || 50
                const rec = getScoreRecommendation(score)
                const recLabel = getRecommendationLabel(rec)
                const avatar = getCompanyAvatarProps(ipo.name)
                const windowText =
                  ipo.status === 'open' || ipo.status === 'closing_today'
                    ? `Closes ${formatRelativeDate(ipo.issue_close_date)}`
                    : `Opens ${formatRelativeDate(ipo.issue_open_date)}`

                return (
                  <tr key={ipo.id} className="cursor-pointer h-[52px]" onClick={() => (window.location.href = `/ipos/${ipo.id}`)}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-sm border flex items-center justify-center font-mono text-[11px] font-medium flex-shrink-0 ${avatar.bg} ${avatar.text}`}
                        >
                          {avatar.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-ink truncate max-w-[240px] flex items-center gap-1.5">
                            <span className="truncate">{ipo.name}</span>
                            {ipo.type === 'SME' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                SME
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0">
                                Mainboard
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] font-mono text-ink-3">
                            {ipo.symbol}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={getStatusPillClass(ipo.status)}>
                        <span className={getStatusDotClass(ipo.status)} />
                        <span>{getStatusLabel(ipo.status)}</span>
                      </span>
                    </td>
                    <td className="text-[13px] text-ink-2 font-mono" suppressHydrationWarning>
                      {windowText}
                    </td>
                    <td className="td-num">
                      ₹{ipo.price_band_min} - ₹{ipo.price_band_max}
                    </td>
                    <td className="td-num" suppressHydrationWarning>
                      {formatINR(ipo.min_investment)}
                    </td>
                    <td className={`td-num ${(ipo.gmp_percent || 0) > 0 ? 'text-emerald-400' : 'text-ink-3'}`}>
                      {(ipo.gmp_percent || 0) > 0 ? `↑ ${formatPercent(ipo.gmp_percent)}` : '0.0%'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] text-ink font-medium w-6">{score}</span>
                        <div className="w-14 h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${getScoreBarColor(score)} transition-all`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-[13px] font-medium tracking-wide uppercase text-ink-2">
                        {recLabel}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/ipos/${ipo.id}`}
                        className="text-[13px] font-medium text-ink hover:underline inline-flex items-center gap-1"
                      >
                        <span>View plan</span>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayList.map((ipo) => (
            <IpoCard key={ipo.id} ipo={ipo} />
          ))}
        </div>
      )}
    </div>
  )
}
