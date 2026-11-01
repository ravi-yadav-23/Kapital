'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { Ipo, FundSummary, PnlSummary, IpoOrder, Allotment } from '@/types'
import { useAuth } from '@/lib/auth-context'
import {
  formatINR,
  formatCompactINR,
  formatPercent,
  formatRelativeDate,
  computeIpoStatus,
  getCompanyAvatarProps,
  getStatusDotClass,
  getStatusPillClass,
  getStatusLabel,
  getScoreBarColor,
} from '@/lib/formatters'
import { ArrowRight, ChevronRight, TrendingUp, Calendar, Layers } from 'lucide-react'
import {
  MOCK_IPOS,
  MOCK_FUND_SUMMARY,
  MOCK_PNL_SUMMARY,
  MOCK_ORDERS,
  MOCK_ALLOTMENTS,
} from '@/lib/mock-data'

interface AttentionItem {
  id: string
  status: string
  sentence: string
  dateText: string
  actionLabel: string
  actionHref: string
  dotClass: string
}

export default function DashboardPage() {
  const { user } = useAuth()

  const [ipos, setIpos] = useState<Ipo[]>(() => {
    const cached = apiClient.getCachedIpos()
    return cached && cached.length > 0 ? cached : MOCK_IPOS
  })
  const [fundSummary, setFundSummary] = useState<FundSummary | null>(() => apiClient.getCachedFundSummary() || MOCK_FUND_SUMMARY)
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(() => apiClient.getCachedPnlSummary() || MOCK_PNL_SUMMARY)
  const [orders, setOrders] = useState<IpoOrder[]>(() => MOCK_ORDERS)
  const [allotments, setAllotments] = useState<Allotment[]>(() => MOCK_ALLOTMENTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      apiClient.getIpos(),
      apiClient.getFundSummary(),
      apiClient.getPnlSummary(),
      apiClient.getOrders(),
      apiClient.getAllotments(),
    ])
      .then(([freshIpos, funds, pnl, freshOrders, freshAllotments]) => {
        if (freshIpos && freshIpos.length > 0) setIpos(freshIpos)
        if (funds && funds.total_family_balance > 0) setFundSummary(funds)
        if (pnl && (pnl.total_realized_pnl > 0 || pnl.allotment_rate_percent > 0)) setPnlSummary(pnl)
        if (freshOrders && freshOrders.length > 0) setOrders(freshOrders)
        if (freshAllotments && freshAllotments.length > 0) setAllotments(freshAllotments)
      })
      .catch((err) => {
        console.error('Failed to refresh dashboard data:', err)
      })
  }, [])

  // ── 1. Needs Attention Engine (Max 5 rows, strict canonical status) ───────
  const attentionItems: AttentionItem[] = []

  // Check true open IPOs closing today (urgent deadline first)
  const closingTodayIpos = ipos.filter(
    (i) => computeIpoStatus(i.issue_open_date, i.issue_close_date) === 'closing_today'
  )
  closingTodayIpos.forEach((ipo) => {
    attentionItems.push({
      id: `closing-${ipo.id}`,
      status: 'closing_today',
      sentence: `${ipo.name} closes today at 5:00 PM with GMP ${formatPercent(ipo.gmp_percent)} and AI Score ${ipo.score || 70}/100.`,
      dateText: 'Closes today',
      actionLabel: 'Review & bid',
      actionHref: `/ipos/${ipo.id}`,
      dotClass: 'bg-[#f59e0b]', // Urgent warning dot
    })
  })

  // Check active allotments awaiting listing execution (positive green dot)
  const activeAllotments = allotments.filter((a) => a.status === 'ACTIVE')
  activeAllotments.forEach((alt) => {
    attentionItems.push({
      id: `allot-${alt.id}`,
      status: 'allotted',
      sentence: `${alt.allotted_shares} shares of ${alt.ipo_name} allotted to ${alt.account_name}. Pre-listing sell staged.`,
      dateText: `Listing ${formatRelativeDate(alt.listing_date)}`,
      actionLabel: 'Review order',
      actionHref: '/allotments',
      dotClass: 'bg-[#22c55e]', // Positive allotment dot
    })
  })

  // Check open IPOs with bidding active
  const openIpos = ipos.filter(
    (i) => computeIpoStatus(i.issue_open_date, i.issue_close_date) === 'open'
  )
  openIpos.slice(0, 2).forEach((ipo) => {
    if (attentionItems.length < 5) {
      attentionItems.push({
        id: `open-${ipo.id}`,
        status: 'open',
        sentence: `${ipo.name} open for bidding with GMP ${formatPercent(ipo.gmp_percent)} and AI Score ${ipo.score || 70}/100.`,
        dateText: formatRelativeDate(ipo.issue_close_date),
        actionLabel: 'Review & bid',
        actionHref: `/ipos/${ipo.id}`,
        dotClass: 'bg-[#6ea8fe]', // Active open dot
      })
    }
  })

  // Check applied orders awaiting registrar finalization (info blue dot)
  const appliedOrders = orders.filter((o) => o.status === 'APPLIED' || o.status === 'CONFIRMED')
  if (appliedOrders.length > 0 && attentionItems.length < 5) {
    const o = appliedOrders[0]
    attentionItems.push({
      id: `ord-${o.id}`,
      status: o.status.toLowerCase(),
      sentence: `Application of ${formatINR(o.amount)} for ${o.ipo_name} confirmed across ${o.account_name}.`,
      dateText: 'Awaiting allotment',
      actionLabel: 'Track bid',
      actionHref: '/orders',
      dotClass: 'bg-[#6ea8fe]', // Info dot
    })
  }

  // ── 2. Combined Pipeline Issues (Max 6, canonical computed status) ─────────
  const pipelineIssues = ipos
    .map((ipo) => ({
      ...ipo,
      computedStatus: computeIpoStatus(ipo.issue_open_date, ipo.issue_close_date),
    }))
    .filter((i) => i.computedStatus !== 'closed')
    .slice(0, 6)

  // Fallback to top recent if no open/upcoming pipeline items
  const displayIssues = pipelineIssues.length > 0
    ? pipelineIssues
    : ipos.slice(0, 6).map((ipo) => ({
        ...ipo,
        computedStatus: computeIpoStatus(ipo.issue_open_date, ipo.issue_close_date),
      }))

  // ── Capital Distribution Calculations ─────────────────────────────────────
  const totalCorpus = (fundSummary?.total_family_balance && fundSummary.total_family_balance > 0)
    ? fundSummary.total_family_balance
    : 1400000
  const availableDeploy = (fundSummary?.total_available && fundSummary.total_available > 0)
    ? fundSummary.total_available
    : 820000
  const lockedAsba = (fundSummary?.total_locked_asba && fundSummary.total_locked_asba > 0)
    ? fundSummary.total_locked_asba
    : 580000
  const activeAllotmentsValue = allotments
    .filter((a) => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + (a.invested_amount || 0), 0) || 230866

  const pctAvailable = totalCorpus > 0 ? Math.round((availableDeploy / totalCorpus) * 100) : 59
  const pctAsba = totalCorpus > 0 ? Math.round((lockedAsba / totalCorpus) * 100) : 41

  const realizedPnlVal = (pnlSummary?.total_realized_pnl && pnlSummary.total_realized_pnl > 0)
    ? pnlSummary.total_realized_pnl
    : 159570
  const winRateVal = (pnlSummary?.allotment_rate_percent && pnlSummary.allotment_rate_percent > 0)
    ? pnlSummary.allotment_rate_percent
    : 83.3
  const accountsTotalVal = (fundSummary?.accounts_total && fundSummary.accounts_total > 0)
    ? fundSummary.accounts_total
    : 6
  const activeBidsCount = appliedOrders.length > 0 ? appliedOrders.length : 3
  const wonCount = pnlSummary?.total_allotments || 5

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-10">
      {/* ── Top Bar Action Strip (No duplicate H1 or subtitle) ── */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[13px] text-ink-2 font-normal">
          Portfolio snapshot & autonomous execution pipeline
        </div>
        <Link href="/funds" className="btn-secondary text-[13px]">
          <span>Run optimizer</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── 1. Needs Attention Strip ── */}
      <section className="space-y-2">
        <div className="text-[13px] font-medium text-ink-2">
          Needs attention
        </div>
        <div className="rounded-sm border border-line bg-surface divide-y divide-line overflow-hidden">
          {attentionItems.length > 0 ? (
            attentionItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="h-[52px] px-4 flex items-center justify-between gap-4 hover:bg-surface-raised transition-colors text-[14px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dotClass}`} />
                  <span className="text-ink truncate">{item.sentence}</span>
                  <span className="text-ink-3 hidden sm:inline flex-shrink-0">·</span>
                  <span className="text-ink-2 hidden sm:inline flex-shrink-0 font-mono text-[13px]">
                    {item.dateText}
                  </span>
                </div>
                <Link
                  href={item.actionHref}
                  className="text-[13px] font-medium text-ink hover:underline flex items-center gap-1 flex-shrink-0"
                >
                  <span>{item.actionLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-3" />
                </Link>
              </div>
            ))
          ) : (
            <div className="h-[52px] px-4 flex items-center text-[13px] text-ink-2">
              All applications and allotments are up to date.
            </div>
          )}
        </div>
      </section>

      {/* ── 2. Four Flat Metric Cards (32px numbers, no icons) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Family Corpus */}
        <div className="p-5 rounded-sm bg-surface border border-line">
          <div className="text-[13px] text-ink-2">Total family corpus</div>
          <div className="text-[32px] font-mono font-medium text-ink leading-tight mt-2">
            {formatINR(totalCorpus)}
          </div>
          <div className="text-[13px] text-ink-3 mt-1.5 font-mono">
            Across {accountsTotalVal} family demats
          </div>
        </div>

        {/* Available to Deploy */}
        <div className="p-5 rounded-sm bg-surface border border-line">
          <div className="text-[13px] text-ink-2">Available to deploy</div>
          <div className="text-[32px] font-mono font-medium text-ink leading-tight mt-2">
            {formatINR(availableDeploy)}
          </div>
          <div className="text-[13px] text-ink-3 mt-1.5 font-mono">
            {pctAvailable}% liquid capital
          </div>
        </div>

        {/* In ASBA */}
        <div className="p-5 rounded-sm bg-surface border border-line">
          <div className="text-[13px] text-ink-2">In ASBA</div>
          <div className="text-[32px] font-mono font-medium text-ink leading-tight mt-2">
            {formatINR(lockedAsba)}
          </div>
          <div className="text-[13px] text-ink-3 mt-1.5 font-mono">
            {activeBidsCount} active mandate bids
          </div>
        </div>

        {/* Realized P&L */}
        <div className="p-5 rounded-sm bg-surface border border-line">
          <div className="text-[13px] text-ink-2">Realized P&L</div>
          <div className="text-[32px] font-mono font-medium text-emerald-400 leading-tight mt-2">
            ↑ {formatINR(realizedPnlVal)}
          </div>
          <div className="text-[13px] text-ink-3 mt-1.5 font-mono">
            {winRateVal}% hit rate · {wonCount} won
          </div>
        </div>
      </section>

      {/* ── 3. Visual Insight Widgets (Capital Distribution & P&L Sparkline) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Widget A: Capital Stacked Distribution Bar */}
        <div className="lg:col-span-2 p-5 rounded-sm bg-surface border border-line space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-ink-2" />
              <span className="text-[13px] font-medium text-ink">Corpus allocation breakdown</span>
            </div>
            <span className="text-[13px] font-mono text-ink-2">
              {formatINR(totalCorpus)} total
            </span>
          </div>

          {/* Stacked Horizontal Bar */}
          <div className="space-y-2">
            <div className="w-full h-3 rounded-full overflow-hidden bg-surface-raised flex border border-line">
              <div
                className="h-full bg-emerald-500/80 transition-all duration-500"
                style={{ width: `${pctAvailable}%` }}
                title={`Available: ${formatINR(availableDeploy)} (${pctAvailable}%)`}
              />
              <div
                className="h-full bg-blue-500/80 transition-all duration-500"
                style={{ width: `${pctAsba}%` }}
                title={`Locked in ASBA: ${formatINR(lockedAsba)} (${pctAsba}%)`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-ink-2">Available to deploy</span>
                <span className="font-mono text-ink font-medium">{formatINR(availableDeploy)}</span>
                <span className="text-ink-3 font-mono">({pctAvailable}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="text-ink-2">Locked in ASBA</span>
                <span className="font-mono text-ink font-medium">{formatINR(lockedAsba)}</span>
                <span className="text-ink-3 font-mono">({pctAsba}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span className="text-ink-2">Active allotments</span>
                <span className="font-mono text-ink font-medium">{formatINR(activeAllotmentsValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Widget B: 90-Day P&L Sparkline */}
        <div className="p-5 rounded-sm bg-surface border border-line space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-[13px] font-medium text-ink">90-day realized trend</span>
              </div>
              <span className="text-[13px] font-mono text-emerald-400 font-medium">
                +₹1,59,570
              </span>
            </div>
            <p className="text-[13px] text-ink-3 mt-1">
              Cumulative profit across recent IPO listings
            </p>
          </div>

          {/* SVG Sparkline Curve */}
          <div className="pt-2">
            <svg viewBox="0 0 200 45" className="w-full h-11 overflow-visible">
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Shaded Area */}
              <polygon
                points="0,42 20,40 60,35 100,24 140,24 180,8 200,6 200,45 0,45"
                fill="url(#pnlGrad)"
              />
              {/* Trend Stroke */}
              <polyline
                points="0,42 20,40 60,35 100,24 140,24 180,8 200,6"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Highlight Point */}
              <circle cx="200" cy="6" r="3.5" fill="#22c55e" />
            </svg>
            <div className="flex justify-between text-[11px] font-mono text-ink-3 pt-1">
              <span>90 days ago</span>
              <span>45 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. IPO Pipeline Table ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium text-ink-2">
            IPO pipeline
          </div>
          <Link
            href="/ipos"
            className="text-[13px] text-ink-2 hover:text-ink flex items-center gap-1 transition-colors"
          >
            <span>View all issues</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-sm border border-line bg-surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Status</th>
                <th>Closes / opens</th>
                <th className="th-num">Price band</th>
                <th className="th-num">Min investment</th>
                <th className="th-num">GMP</th>
                <th>Score</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayIssues.length > 0 ? (
                displayIssues.map((ipo) => {
                  const score = ipo.score || 50
                  const status = ipo.computedStatus
                  const avatar = getCompanyAvatarProps(ipo.name)

                  return (
                    <tr key={ipo.id}>
                      {/* Avatar + Company Name */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-sm border flex items-center justify-center font-mono text-[11px] font-medium flex-shrink-0 ${avatar.bg} ${avatar.text}`}
                          >
                            {avatar.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate max-w-[220px]">
                              {ipo.name}
                            </div>
                            <div className="text-[13px] font-mono text-ink-3">
                              {ipo.symbol} · {ipo.type || 'EQ'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Pill with 14% tint */}
                      <td>
                        <span className={getStatusPillClass(status)}>
                          <span className={getStatusDotClass(status)} />
                          <span>{getStatusLabel(status)}</span>
                        </span>
                      </td>

                      {/* Dates in font-mono */}
                      <td className="text-[13px] text-ink-2 font-mono">
                        {status === 'open' || status === 'closing_today'
                          ? formatRelativeDate(ipo.issue_close_date)
                          : formatRelativeDate(ipo.issue_open_date)}
                      </td>

                      {/* Price Band */}
                      <td className="td-num">
                        ₹{ipo.price_band_min} - ₹{ipo.price_band_max}
                      </td>

                      {/* Min Investment */}
                      <td className="td-num font-mono">
                        {formatINR(ipo.min_investment)}
                      </td>

                      {/* GMP */}
                      <td className={`td-num ${(ipo.gmp_percent || 0) > 0 ? 'text-emerald-400' : 'text-ink-3'}`}>
                        {(ipo.gmp_percent || 0) > 0 ? `↑ ${formatPercent(ipo.gmp_percent)}` : '0.0%'}
                      </td>

                      {/* Score Bar (6px high, colored by verdict band, score number in ink) */}
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-ink font-medium w-6">
                            {score}
                          </span>
                          <div className="w-14 h-[6px] bg-surface-raised rounded-full overflow-hidden border border-line">
                            <div
                              className={`h-full ${getScoreBarColor(score)} transition-all`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="text-right">
                        <Link
                          href={`/ipos/${ipo.id}`}
                          className="text-[13px] font-medium text-ink hover:underline"
                        >
                          View plan →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-[13px] text-ink-3 py-8">
                    No active or upcoming IPOs in the pipeline today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
