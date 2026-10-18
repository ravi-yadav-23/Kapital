'use client'

import React from 'react'
import Link from 'next/link'
import { Ipo } from '@/types'
import { ScoreBadge } from '../shared/ScoreBadge'
import { StatusPill } from '../shared/StatusPill'
import { AmountDisplay } from '../shared/AmountDisplay'
import { SubscriptionBar } from './SubscriptionBar'
import { formatPercent, formatDate, getDaysRemainingText } from '@/lib/formatters'
import { Calendar, ArrowRight, Flame, Send, Clock } from 'lucide-react'

interface IpoCardProps {
  ipo: Ipo
  onApply?: (ipo: Ipo) => void
}

export function IpoCard({ ipo, onApply }: IpoCardProps) {
  const daysLeft = getDaysRemainingText(ipo.issue_close_date)
  const isClosingToday = ipo.status === 'closing_today'
  const isClosed = ipo.status === 'closed'
  const isOpen = ipo.status === 'open' || isClosingToday
  const isUpcoming = ipo.status === 'upcoming' || ipo.status === 'allotted' || ipo.status === 'listed'

  return (
    <div className="card flex flex-col justify-between group hover:border-brand-from/40 transition-all duration-300 relative overflow-hidden bg-surface-card border-border-default">
      {/* Top Section */}
      <div className="space-y-3.5">
        {/* Header: Logo, Name, Symbol, Sector Tag, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {ipo.logo_url ? (
              <img
                src={ipo.logo_url}
                alt={ipo.name}
                className="w-11 h-11 rounded-xl object-contain bg-white/5 p-1.5 border border-border-subtle flex-shrink-0"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-from/20 to-brand-to/20 flex items-center justify-center text-xs font-bold text-brand-from border border-brand-from/25 flex-shrink-0">
                {ipo.symbol.slice(0, 3)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-text-primary truncate group-hover:text-brand-from transition-colors">
                {ipo.name}
              </h3>
              <div className="flex items-center gap-2 text-2xs text-text-secondary mt-0.5">
                <span className="font-semibold text-text-primary">{ipo.symbol}</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-surface-elevated text-brand-from font-semibold uppercase text-[10px]">
                  {ipo.type}
                </span>
                <span>•</span>
                <span>{ipo.issue_size}</span>
              </div>
            </div>
          </div>

          <StatusPill status={ipo.status} />
        </div>

        {/* Score Badge + Recommendation Pill + GMP Banner */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated border border-border-subtle">
          <div className="flex items-center gap-2">
            <ScoreBadge score={ipo.score} showLabel size="sm" />
          </div>

          {ipo.gmp_percent !== undefined ? (
            <div className="flex items-center gap-1 text-xs font-bold text-accent-green">
              <Flame className="w-3.5 h-3.5 fill-accent-green/20" />
              <span>GMP: {formatPercent(ipo.gmp_percent, true)}</span>
            </div>
          ) : (
            <span className="text-2xs text-text-muted">GMP: N/A</span>
          )}
        </div>

        {/* Key Pricing & Lot Size Parameters Grid - Clean Groww Style */}
        <div className="grid grid-cols-2 gap-3 p-3 text-xs bg-surface-elevated/50 rounded-xl">
          <div>
            <span className="text-2xs text-text-muted block">Price Band</span>
            <span className="font-semibold text-text-primary text-sm">
              ₹{ipo.price_band_min} - ₹{ipo.price_band_max}
            </span>
          </div>

          <div>
            <span className="text-2xs text-text-muted block">Min Investment</span>
            <AmountDisplay amount={ipo.min_investment} className="text-sm font-semibold text-text-primary" />
            <span className="text-[11px] text-text-muted block mt-0.5">({ipo.lot_size} shares/lot)</span>
          </div>
        </div>

        {/* Live Subscription Status Bar (Retail / sHNI / bHNI) */}
        <SubscriptionBar
          retail={ipo.subscription_retail}
          shni={ipo.subscription_shni}
          bhni={ipo.subscription_bhni}
          total={ipo.subscription_total}
          compact={true}
        />
      </div>

      {/* Footer: Open/Close Dates & Action Buttons */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex flex-col gap-2.5">
        {/* Timeline countdown indicator */}
        <div className="flex items-center justify-between text-2xs">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span>
              {ipo.status === 'open' || isClosingToday ? (
                <span>Closes: <strong className="text-text-primary">{formatDate(ipo.issue_close_date)}</strong></span>
              ) : (
                <span>Opens: <strong className="text-text-primary">{formatDate(ipo.issue_open_date)}</strong></span>
              )}
            </span>
          </div>

          {isClosingToday ? (
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-accent-amber/15 text-accent-amber border border-accent-amber/30 animate-pulse">
              Closing Today ({daysLeft})
            </span>
          ) : (
            <span className="text-2xs text-text-muted">{daysLeft}</span>
          )}
        </div>

        {/* Action Buttons: Apply & View Detail */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/ipos/${ipo.id}`}
            className="btn btn-ghost btn-sm flex-1 justify-center text-xs"
          >
            <span>View Details</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>

          {isOpen && onApply ? (
            <button
              type="button"
              onClick={() => onApply(ipo)}
              className="btn btn-primary btn-sm flex-1 justify-center text-xs gap-1.5 shadow-md shadow-brand-from/20"
            >
              <Send className="w-3 h-3" />
              <span>View Allocation Plan</span>
            </button>
          ) : isUpcoming ? (
            <Link
              href={`/ipos/${ipo.id}`}
              className="btn btn-ghost btn-sm flex-1 justify-center text-xs text-accent-blue bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20"
            >
              <Clock className="w-3 h-3 mr-1" />
              <span>Opens {formatDate(ipo.issue_open_date)}</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
