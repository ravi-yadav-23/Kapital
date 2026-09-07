'use client'

import React, { useState, useMemo } from 'react'
import { Allotment } from '@/types'
import { AllotmentCard } from './AllotmentCard'
import { SellModal } from './SellModal'
import { Clock, DollarSign, Layers, Search, Sparkles } from 'lucide-react'

interface AllotmentGridProps {
  allotments: Allotment[]
}

type TabType = 'ACTIVE' | 'SOLD' | 'INACTIVE' | 'ALL'

export function AllotmentGrid({ allotments }: AllotmentGridProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSellAllotment, setSelectedSellAllotment] = useState<Allotment | null>(null)

  const activeCount = useMemo(
    () => allotments.filter((a) => a.status === 'ACTIVE').length,
    [allotments]
  )
  const soldCount = useMemo(
    () => allotments.filter((a) => a.status === 'SOLD').length,
    [allotments]
  )
  const inactiveCount = useMemo(
    () => allotments.filter((a) => a.status === 'INACTIVE').length,
    [allotments]
  )

  const filteredAllotments = useMemo(() => {
    return allotments.filter((item) => {
      if (activeTab !== 'ALL' && item.status !== activeTab) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchIpo = item.ipo_name.toLowerCase().includes(q)
        const matchSymbol = item.ipo_symbol.toLowerCase().includes(q)
        const matchAcc = item.account_name.toLowerCase().includes(q)
        if (!matchIpo && !matchSymbol && !matchAcc) return false
      }

      return true
    })
  }, [allotments, activeTab, searchQuery])

  return (
    <div className="space-y-5">
      {/* Tab Navigation & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Tab */}
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Allotments</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {activeCount}
            </span>
          </button>

          {/* Executed Sales Tab */}
          <button
            onClick={() => setActiveTab('SOLD')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'SOLD'
                ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Executed Sales</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {soldCount}
            </span>
          </button>

          {/* Inactive Tab */}
          <button
            onClick={() => setActiveTab('INACTIVE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'INACTIVE'
                ? 'bg-surface-elevated text-text-primary border border-border-strong shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <span>Unallocated (Refunds)</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {inactiveCount}
            </span>
          </button>

          {/* All Tab */}
          <button
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ALL'
                ? 'bg-brand-from/15 text-brand-from border border-brand-from/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Records</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-surface-elevated font-mono">
              {allotments.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search IPO or family member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-surface-elevated border-border-subtle"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {filteredAllotments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filteredAllotments.map((allotment) => (
            <AllotmentCard
              key={allotment.id}
              allotment={allotment}
              onSellTrigger={(item) => setSelectedSellAllotment(item)}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3 bg-surface-elevated/40">
          <Sparkles className="w-8 h-8 text-text-muted/50" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text-secondary">
              No allotments in this section
            </h4>
            <p className="text-2xs text-text-muted">
              Allotments will automatically populate here as soon as registrar polling confirms demat allocations.
            </p>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {selectedSellAllotment && (
        <SellModal
          allotment={selectedSellAllotment}
          isOpen={!!selectedSellAllotment}
          onClose={() => setSelectedSellAllotment(null)}
        />
      )}
    </div>
  )
}