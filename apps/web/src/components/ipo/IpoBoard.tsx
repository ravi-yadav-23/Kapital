'use client'

import React, { useState, useMemo } from 'react'
import { Ipo, FamilyAccount, IpoType } from '@/types'
import { IpoCard } from './IpoCard'
import { ApplyModal } from './ApplyModal'
import { TrendingUp, Clock, Calendar, Archive, Layers, Search, Filter, RotateCcw, Sparkles } from 'lucide-react'
import { MOCK_ACCOUNTS } from '@/lib/mock-data'

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
  accounts = MOCK_ACCOUNTS,
  maxItemsPerTab,
  showViewAll = false,
  showFilters = true,
}: IpoBoardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('open')
  const [isFiltersOpen, setIsFiltersOpen] = useState(showFilters && !maxItemsPerTab)
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [minScore, setMinScore] = useState<number>(0)
  const [maxInvestment, setMaxInvestment] = useState<number>(200000)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [applyingIpo, setApplyingIpo] = useState<Ipo | null>(null)

  // Tab counts
  const openCount = useMemo(() => ipos.filter((i) => i.status === 'open').length, [ipos])
  const closingCount = useMemo(() => ipos.filter((i) => i.status === 'closing_today').length, [ipos])
  const upcomingCount = useMemo(() => ipos.filter((i) => i.status === 'upcoming').length, [ipos])
  const closedCount = useMemo(
    () => ipos.filter((i) => i.status === 'closed' || i.status === 'allotted' || i.status === 'listed').length,
    [ipos]
  )

  // Filtered list based on active tab and filter controls
  const filteredIpos = useMemo(() => {
    return ipos.filter((ipo) => {
      // 1. Status Tab filter
      if (activeTab === 'open' && ipo.status !== 'open') return false
      if (activeTab === 'closing_today' && ipo.status !== 'closing_today') return false
      if (activeTab === 'upcoming' && ipo.status !== 'upcoming') return false
      if (
        activeTab === 'closed' &&
        ipo.status !== 'closed' &&
        ipo.status !== 'allotted' &&
        ipo.status !== 'listed'
      )
        return false

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
  }, [ipos, activeTab, selectedType, minScore, maxInvestment, searchQuery])

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
    <div className="space-y-5">
      {/* ── 1. Tab Navigation ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab: Open Now */}
          <button
            onClick={() => setActiveTab('open')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'open'
                ? 'bg-status-open text-status-open-fg border border-accent-green/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <span className="dot-pulse" />
            <span>Open Now</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {openCount}
            </span>
          </button>

          {/* Tab: Closing Today */}
          <button
            onClick={() => setActiveTab('closing_today')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'closing_today'
                ? 'bg-status-closing text-status-closing-fg border border-accent-amber/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Closing Today</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {closingCount}
            </span>
          </button>

          {/* Tab: Upcoming */}
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-status-upcoming text-status-upcoming-fg border border-accent-blue/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Upcoming</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {upcomingCount}
            </span>
          </button>

          {/* Tab: Closed */}
          <button
            onClick={() => setActiveTab('closed')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'closed'
                ? 'bg-surface-elevated text-text-primary border border-border-strong shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Closed</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {closedCount}
            </span>
          </button>

          {/* Tab: All */}
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-brand-from/15 text-brand-from border border-brand-from/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Issues</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {ipos.length}
            </span>
          </button>
        </div>

        {/* Filter Toggle Button */}
        {showFilters && (
          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isFiltersOpen
                ? 'bg-brand-from/15 text-brand-from border border-brand-from/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated border border-border-subtle'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{isFiltersOpen ? 'Hide Filters' : 'Smart Filters'}</span>
            {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-brand-from animate-pulse" />}
          </button>
        )}
      </div>

      {/* ── 2. Filters Bar ─────────────────────────────────────────────────── */}
      {showFilters && isFiltersOpen && (
        <div className="card p-4 bg-surface-elevated/40 border-border-subtle space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Filter className="w-4 h-4 text-brand-from" />
              <span>Smart Filters</span>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-2xs font-semibold text-accent-red hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Search Input */}
            <div>
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
                Search Issue
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Swiggy, KRT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-surface-card border-border-subtle"
                />
              </div>
            </div>

            {/* Type selector */}
            <div>
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
                Issue Type
              </label>
              <div className="flex gap-1">
                {['ALL', 'EQ', 'SME', 'REIT'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`flex-1 py-1.5 rounded-lg font-mono text-2xs font-semibold transition-all border ${
                      selectedType === type
                        ? 'bg-brand-from text-white border-brand-from shadow-sm'
                        : 'bg-surface-card text-text-secondary border-border-subtle hover:bg-surface-elevated'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Score Range Slider */}
            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="font-semibold text-text-muted uppercase">Min Score:</span>
                <span className="font-mono font-bold text-brand-from">{minScore}/100</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
                className="w-full accent-brand-from cursor-pointer h-1.5 bg-surface-card rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-0.5 font-mono">
                <span>0 (All)</span>
                <span>60 (Moderate)</span>
                <span>80 (Strong)</span>
              </div>
            </div>

            {/* Max Investment range */}
            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="font-semibold text-text-muted uppercase">Max Retail Investment:</span>
                <span className="font-mono font-bold text-text-primary">
                  ₹{(maxInvestment / 1000).toFixed(0)}k
                </span>
              </div>
              <input
                type="range"
                min={15000}
                max={200000}
                step={15000}
                value={maxInvestment}
                onChange={(e) => setMaxInvestment(parseInt(e.target.value))}
                className="w-full accent-brand-from cursor-pointer h-1.5 bg-surface-card rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-0.5 font-mono">
                <span>₹15k</span>
                <span>₹1 Lakh</span>
                <span>₹2 Lakhs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. IPO Cards Grid ──────────────────────────────────────────────── */}
      {displayList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
          {displayList.map((ipo) => (
            <IpoCard key={ipo.id} ipo={ipo} onApply={(item) => setApplyingIpo(item)} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3 bg-surface-elevated/40">
          <Sparkles className="w-8 h-8 text-text-muted/50" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text-secondary">
              No IPOs matched your filters
            </h4>
            <p className="text-2xs text-text-muted">
              Try adjusting your search query, score slider, or switching tabs.
            </p>
          </div>
          {isFiltered && (
            <button onClick={handleResetFilters} className="btn btn-ghost btn-sm mt-2 text-xs">
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── 4. Apply Modal ─────────────────────────────────────────────────── */}
      {applyingIpo && (
        <ApplyModal
          ipo={applyingIpo}
          accounts={accounts}
          isOpen={!!applyingIpo}
          onClose={() => setApplyingIpo(null)}
        />
      )}
    </div>
  )
}
