'use client'

import React, { useState, useEffect } from 'react'
import {
  formatINR,
  formatCompactINR,
  formatPercent,
  formatRelativeDate,
  formatDateTime,
  getStatusDotClass,
  getStatusLabel,
} from '@/lib/formatters'
import {
  Sun,
  Moon,
  Search,
  Check,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Trash2,
  RefreshCw,
} from 'lucide-react'

export default function DesignPreviewPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 sm:p-12 transition-colors duration-150">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between border-b border-line pb-6">
          <div>
            <h1 className="text-lg font-medium text-ink">Kapitl Primitives & Design Tokens (v2)</h1>
            <p className="text-xs text-ink-2 mt-1">
              Ramp × Mercury × Linear — Restraint as Confidence. Single accent amber, warm neutrals.
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>Theme: <strong className="capitalize">{theme}</strong></span>
          </button>
        </div>

        {/* 1. Buttons System */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            1. Controlled Button System (Exactly 4 Primitives)
          </h2>
          <div className="p-6 rounded-md bg-surface border border-line flex flex-wrap items-center gap-4">
            <button className="btn-primary">
              <span>Run Optimizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button className="btn-secondary">
              <span>Filter Issues</span>
            </button>
            <button className="btn-ghost" title="Refresh data">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="btn-destructive">
              <Trash2 className="w-4 h-4" />
              <span>Cancel Order</span>
            </button>
            <button className="btn-primary" disabled>
              <span>Disabled Primary</span>
            </button>
            <button className="btn-secondary" disabled>
              <span>Disabled Secondary</span>
            </button>
          </div>
        </section>

        {/* 2. Status System */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            2. Status System (Dot + Transparent Pill, Green / Red / Grey Only)
          </h2>
          <div className="p-6 rounded-md bg-surface border border-line flex flex-wrap items-center gap-3">
            {['open', 'confirmed', 'allotted', 'sold', 'upcoming', 'closing_today', 'applied', 'cancelled', 'rejected', 'closed'].map(
              (st) => (
                <span key={st} className="status-pill">
                  <span className={getStatusDotClass(st)} />
                  <span>{getStatusLabel(st)}</span>
                </span>
              )
            )}
          </div>
        </section>

        {/* 3. Horizontal Score Bar */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            3. Horizontal Score Gauges (3px Bar, Amber Fill to Score%)
          </h2>
          <div className="p-6 rounded-md bg-surface border border-line grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Score 82 - Strong Apply */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline font-mono">
                <span className="text-ink text-xl font-medium">82</span>
                <span className="text-xs text-ink-3">/ 100</span>
              </div>
              <div className="w-full h-[3px] bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-400" style={{ width: '82%' }} />
              </div>
              <div className="text-2xs font-medium tracking-wide uppercase text-accent">
                Strong Apply
              </div>
            </div>

            {/* Score 64 - Moderate Apply */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline font-mono">
                <span className="text-ink text-xl font-medium">64</span>
                <span className="text-xs text-ink-3">/ 100</span>
              </div>
              <div className="w-full h-[3px] bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-ink-2 transition-all duration-400" style={{ width: '64%' }} />
              </div>
              <div className="text-2xs font-medium tracking-wide uppercase text-ink-2">
                Moderate Apply
              </div>
            </div>

            {/* Score 38 - Avoid */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline font-mono">
                <span className="text-ink text-xl font-medium">38</span>
                <span className="text-xs text-ink-3">/ 100</span>
              </div>
              <div className="w-full h-[3px] bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-negative transition-all duration-400" style={{ width: '38%' }} />
              </div>
              <div className="text-2xs font-medium tracking-wide uppercase text-negative">
                Avoid
              </div>
            </div>
          </div>
        </section>

        {/* 4. Financial Number Formatting */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            4. Indian Currency & Tabular Number Formatting
          </h2>
          <div className="p-6 rounded-md bg-surface border border-line grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-ink-2">Total Corpus (Full)</div>
              <div className="text-2xl font-mono font-medium text-ink mt-1">
                {formatINR(1400000)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-2">Available (Compact)</div>
              <div className="text-2xl font-mono font-medium text-ink mt-1">
                {formatCompactINR(820000)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-2">Realized P&L (Gain)</div>
              <div className="text-2xl font-mono font-medium val-positive mt-1">
                ↑ {formatINR(159570)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-2">Relative Date</div>
              <div className="text-sm font-medium text-ink mt-2">
                {formatRelativeDate(new Date(Date.now() + 86400000).toISOString())}
              </div>
            </div>
          </div>
        </section>

        {/* 5. High-Density Data Table */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            5. High-Density Table (32px Header, 44px Row, Right-Aligned Mono)
          </h2>
          <div className="rounded-md border border-line bg-surface overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Target IPO</th>
                  <th>Category</th>
                  <th className="th-num">Lots</th>
                  <th className="th-num">Applied Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ramesh Yadav</td>
                  <td>Tonbo Imaging India Ltd</td>
                  <td><span className="category-tag">sHNI</span></td>
                  <td className="td-num">28</td>
                  <td className="td-num">{formatINR(412776)}</td>
                  <td>
                    <span className="status-pill">
                      <span className="status-dot-green" />
                      <span>Confirmed</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Sunita Yadav</td>
                  <td>Tonbo Imaging India Ltd</td>
                  <td><span className="category-tag">RETAIL</span></td>
                  <td className="td-num">10</td>
                  <td className="td-num">{formatINR(147420)}</td>
                  <td>
                    <span className="status-pill">
                      <span className="status-dot-green" />
                      <span>Confirmed</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Vikram Yadav</td>
                  <td>Tonbo Imaging India Ltd</td>
                  <td><span className="category-tag">RETAIL</span></td>
                  <td className="td-num">1</td>
                  <td className="td-num">{formatINR(19804)}</td>
                  <td>
                    <span className="status-pill">
                      <span className="status-dot-grey-solid" />
                      <span>Applied</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Empty State & Skeletons */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider text-xs">
            6. Empty State & Skeletons
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Empty state */}
            <div className="p-8 rounded-md bg-surface border border-line text-center space-y-3">
              <div className="text-sm font-medium text-ink">No active allotments found</div>
              <p className="text-xs text-ink-2 max-w-xs mx-auto">
                Mark an order as allotted in the Orders section or wait for registrar confirmation.
              </p>
              <button className="btn-secondary text-xs">
                <span>View Orders →</span>
              </button>
            </div>

            {/* Skeletons */}
            <div className="p-6 rounded-md bg-surface border border-line space-y-3">
              <div className="text-xs text-ink-2">Loading Rows (No Spinners)</div>
              <div className="skeleton-bar h-4 w-3/4" />
              <div className="skeleton-bar h-4 w-full" />
              <div className="skeleton-bar h-4 w-1/2" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
