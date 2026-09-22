'use client'

import React from 'react'
import { ScoreBreakdown } from '@/types'
import { Sparkles, FileText, Flame, MessageSquare, Target, TrendingUp, Clock } from 'lucide-react'

interface IpoScoreBreakdownProps {
  breakdown?: ScoreBreakdown
}

export function IpoScoreBreakdown({ breakdown }: IpoScoreBreakdownProps) {
  if (!breakdown) return null

  const items = [
    {
      label: 'Financial Quality (DRHP Analysis)',
      weight: '25%',
      max: 25,
      value: breakdown.financial_quality,
      color: 'bg-brand-from',
      textColor: 'text-brand-from',
      icon: FileText,
      description: 'Revenue CAGR, operating cash flow, debt/equity, promoter holding & audit opinion.',
    },
    {
      label: 'GMP Signal (Grey Market Premium)',
      weight: '20%',
      max: 20,
      value: breakdown.gmp_signal,
      color: 'bg-accent-green',
      textColor: 'text-accent-green',
      icon: Flame,
      description: 'Realized informal market premium & demand density from investor forums.',
    },
    {
      label: 'Subscription Hype & Sentiment',
      weight: '20%',
      max: 20,
      value: breakdown.subscription_hype,
      color: 'bg-brand-to',
      textColor: 'text-brand-to',
      icon: MessageSquare,
      description: 'Retail buzz, institutional bid momentum, and media sentiment index.',
    },
    {
      label: 'Allotment Probability Math',
      weight: '15%',
      max: 15,
      value: breakdown.allotment_probability,
      color: 'bg-accent-blue',
      textColor: 'text-accent-blue',
      icon: Target,
      description: 'Category lot math × subscription multiple expected hit rate per demat.',
    },
    {
      label: 'Industry Trend & Sector Momentum',
      weight: '10%',
      max: 10,
      value: breakdown.industry_trend,
      color: 'bg-accent-purple',
      textColor: 'text-accent-purple',
      icon: TrendingUp,
      description: 'Sector valuation multiples, tailwinds, and recent peer listing gains.',
    },
    {
      label: 'Fund Lock-in Conflict Fit',
      weight: '10%',
      max: 10,
      value: breakdown.lock_in_conflict,
      color: 'bg-accent-cyan',
      textColor: 'text-accent-cyan',
      icon: Clock,
      description: 'ASBA capital lock-in compatibility vs upcoming higher-score IPO schedule.',
    },
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-from" />
        <h3 className="text-sm font-semibold text-text-primary">
          Detailed Dimension Breakdown (0–100)
        </h3>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const pct = Math.min((item.value / item.max) * 100, 100)
          const Icon = item.icon

          return (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${item.textColor}`} />
                  <span className="font-semibold text-text-primary">{item.label}</span>
                  <span className="text-2xs font-mono text-text-muted">({item.weight})</span>
                </div>
                <span className="font-mono font-bold text-text-primary">
                  {item.value} / {item.max}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-[11px] text-text-muted">{item.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
