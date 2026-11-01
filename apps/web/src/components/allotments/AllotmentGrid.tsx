'use client'

import React, { useState, useMemo } from 'react'
import { Allotment } from '@/types'
import { AllotmentCard } from './AllotmentCard'
import { SellModal } from './SellModal'
import { formatDate, formatINR, getStatusDotClass } from '@/lib/formatters'
import { Search, LayoutGrid, List } from 'lucide-react'

interface AllotmentGridProps {
  allotments: Allotment[]
}

type TabType = 'ACTIVE' | 'SOLD' | 'ALL'

export function AllotmentGrid({ allotments }: AllotmentGridProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedSellAllotment, setSelectedSellAllotment] = useState<Allotment | null>(null)

  const activeCount = useMemo(
    () => allotments.filter((a) => a.status === 'ACTIVE').length,
    [allotments]
  )
  const soldCount = useMemo(
    () => allotments.filter((a) => a.status === 'SOLD').length,
    [allotments]
  )
  const totalCount = allotments.length

  const filteredAllotments = useMemo(() => {
    return allotments.filter((item) => {
      if (activeTab === 'ACTIVE' && item.status !== 'ACTIVE') return false
      if (activeTab === 'SOLD' && item.status !== 'SOLD') return false

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
    <div className="space-y-4">
      {/* Tab Navigation, View Toggle & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3">
        {/* Understated Text Tabs */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'ACTIVE'
                ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)] font-medium border border-[var(--border-strong)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
            }`}
          >
            Active ({activeCount})
          </button>

          <button
            onClick={() => setActiveTab('SOLD')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'SOLD'
                ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)] font-medium border border-[var(--border-strong)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
            }`}
          >
            Sold ({soldCount})
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'ALL'
                ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)] font-medium border border-[var(--border-strong)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
            }`}
          >
            All ({totalCount})
          </button>
        </div>

        {/* Search & Layout Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search holdings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs"
            />
          </div>

          <div className="flex items-center border border-[var(--border-default)] rounded p-0.5 bg-[var(--bg-surface)]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded ${
                viewMode === 'table'
                  ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1 rounded ${
                viewMode === 'cards'
                  ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredAllotments.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-xs text-[var(--ink-2)]">No active allotments found in this view.</p>
          <p className="text-2xs text-[var(--ink-3)] mt-1 max-w-sm mx-auto">
            Mark an order as allotted on the Orders page and it will automatically populate here for listing-day sell execution.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target IPO</th>
                  <th>Demat Account</th>
                  <th>Allotted Shares</th>
                  <th className="text-right">Invested</th>
                  <th>Listing Date</th>
                  <th>Status</th>
                  <th className="text-right">Gain / P&L</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllotments.map((item) => {
                  const isActive = item.status === 'ACTIVE'
                  const isSold = item.status === 'SOLD'
                  const estGain = Math.round((item.invested_amount * (item.roi_percent || 0)) / 100)

                  return (
                    <tr key={item.id}>
                      <td className="font-medium text-[var(--ink-1)]">
                        <div>{item.ipo_name}</div>
                        <span className="text-2xs font-mono text-[var(--ink-3)]">{item.ipo_symbol}</span>
                      </td>

                      <td className="text-[var(--ink-2)]">
                        {item.account_name}
                      </td>

                      <td className="font-mono text-xs text-[var(--ink-2)] tabular-nums">
                        {item.allotted_shares} shs @ ₹{item.issue_price}
                      </td>

                      <td className="text-right font-mono text-xs text-[var(--ink-1)] font-medium tabular-nums">
                        {formatINR(item.invested_amount)}
                      </td>

                      <td className="font-mono text-2xs text-[var(--ink-3)]">
                        {formatDate(item.listing_date)}
                      </td>

                      <td>
                        <div className="status-pill status-pill-neutral">
                          <span className={`status-dot ${getStatusDotClass(item.status)}`} />
                          <span>{isActive ? 'Active' : isSold ? 'Sold' : item.status}</span>
                        </div>
                      </td>

                      <td className="text-right font-mono text-xs font-medium tabular-nums text-[var(--positive)]">
                        {isSold
                          ? `+${formatINR(item.realized_pnl || 0)} (+${item.roi_percent}%)`
                          : `+${formatINR(estGain)} (+${item.roi_percent}%)`}
                      </td>

                      <td className="text-right">
                        {isActive ? (
                          <button
                            onClick={() => setSelectedSellAllotment(item)}
                            className="btn btn-secondary btn-sm"
                          >
                            Stage Sell
                          </button>
                        ) : (
                          <span className="text-2xs font-mono text-[var(--ink-3)]">
                            Liquidated
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAllotments.map((item) => (
            <AllotmentCard
              key={item.id}
              allotment={item}
              onSellTrigger={(allot) => setSelectedSellAllotment(allot)}
            />
          ))}
        </div>
      )}

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
