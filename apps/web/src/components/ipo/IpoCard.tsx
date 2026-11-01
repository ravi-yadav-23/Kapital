'use client'

import React from 'react'
import Link from 'next/link'
import { Ipo } from '@/types'
import {
  formatINR,
  formatPercent,
  formatRelativeDate,
  getStatusDotClass,
  getStatusLabel,
  getScoreRecommendation,
  getRecommendationLabel,
} from '@/lib/formatters'
import { ArrowRight } from 'lucide-react'

interface IpoCardProps {
  ipo: Ipo
}

export function IpoCard({ ipo }: IpoCardProps) {
  const score = ipo.score || 50
  const isHigh = score >= 70
  const isMed = score >= 50 && score < 70
  const rec = getScoreRecommendation(score)
  const recLabel = getRecommendationLabel(rec)

  const barColor = isHigh ? 'bg-accent' : isMed ? 'bg-ink-2' : 'bg-ink-3'
  const textColor = isHigh ? 'text-accent' : isMed ? 'text-ink-2' : 'text-ink-3'

  const dateText =
    ipo.status === 'open' || ipo.status === 'closing_today'
      ? `Closes ${formatRelativeDate(ipo.issue_close_date)}`
      : `Opens ${formatRelativeDate(ipo.issue_open_date)}`

  return (
    <Link
      href={`/ipos/${ipo.id}`}
      className="p-4 rounded-sm bg-surface border border-line hover:border-line-strong hover:bg-surface-raised transition-colors flex flex-col justify-between space-y-4 group"
    >
      {/* Eyebrow Header: Status dot + GMP */}
      <div className="flex items-center justify-between text-xs">
        <span className="status-pill">
          <span className={getStatusDotClass(ipo.status)} />
          <span>{getStatusLabel(ipo.status)}</span>
        </span>
        {(ipo.gmp_percent || 0) > 0 ? (
          <span className="val-positive text-xs font-mono font-medium">
            ↑ {formatPercent(ipo.gmp_percent)} GMP
          </span>
        ) : (
          <span className="text-2xs text-ink-3 font-mono">0.0% GMP</span>
        )}
      </div>

      {/* Company Name & Symbol */}
      <div>
        <h3 className="font-medium text-sm text-ink truncate group-hover:text-ink">
          {ipo.name}
        </h3>
        <div className="text-2xs font-mono text-ink-3 mt-0.5">
          {ipo.symbol} · {ipo.type || 'EQ'} · NSE
        </div>
      </div>

      <div className="w-full h-px bg-line" />

      {/* 3px Horizontal Score Gauge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-ink text-sm font-medium">{score}</span>
          <span className="text-ink-3 text-2xs">100</span>
        </div>
        <div className="w-full h-[3px] bg-surface-raised rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-400`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
        <div className={`text-[11px] font-medium tracking-wide uppercase ${textColor}`}>
          {recLabel}
        </div>
      </div>

      {/* Financial Parameters: Price Band, Min Invest, Lot Size */}
      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
        <div>
          <span className="text-ink font-medium block">
            ₹{ipo.price_band_max || ipo.price_band_min}
          </span>
          <span className="text-[11px] text-ink-3 font-sans block mt-0.5">Price</span>
        </div>
        <div>
          <span className="text-ink font-medium block" suppressHydrationWarning>
            {formatINR(ipo.min_investment)}
          </span>
          <span className="text-[11px] text-ink-3 font-sans block mt-0.5">Min invest</span>
        </div>
        <div>
          <span className="text-ink font-medium block">
            {ipo.lot_size} sh
          </span>
          <span className="text-[11px] text-ink-3 font-sans block mt-0.5">Lot size</span>
        </div>
      </div>

      <div className="w-full h-px bg-line" />

      {/* Footer: Date & Navigation arrow */}
      <div className="flex items-center justify-between text-xs text-ink-2 pt-0.5">
        <span className="text-[11px] font-mono text-ink-3 truncate" suppressHydrationWarning>{dateText}</span>
        <span className="text-xs font-medium text-ink group-hover:underline flex items-center gap-1 flex-shrink-0">
          <span>View plan</span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-ink transition-colors" />
        </span>
      </div>
    </Link>
  )
}
