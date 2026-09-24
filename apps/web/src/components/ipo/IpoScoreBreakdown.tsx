'use client'

import React from 'react'
import { ScoreBreakdown } from '@/types'
import { Sparkles, FileText, Flame, MessageSquare, Target, TrendingUp, Clock } from 'lucide-react'

interface IpoScoreBreakdownProps {
  breakdown?: ScoreBreakdown
}

export function IpoScoreBreakdown({ breakdown }: IpoScoreBreakdownProps) {
  if (!breakdown) return null

  const finScore = Math.max(0, Math.min(100, Math.round(breakdown.financial_quality ?? 0)))
  const valScore = Math.max(0, Math.min(100, Math.round(breakdown.valuation_safety ?? breakdown.allotment_probability ?? 50)))
  const gmpScore = Math.max(0, Math.min(100, Math.round(breakdown.gmp_strength ?? breakdown.gmp_signal ?? 0)))
  const govScore = Math.max(0, Math.min(100, Math.round(breakdown.promoter_integrity ?? breakdown.lock_in_conflict ?? 60)))
  const indScore = Math.max(0, Math.min(100, Math.round(breakdown.industry_tailwinds ?? breakdown.industry_trend ?? 65)))
  const subScore = Math.max(0, Math.min(100, Math.round(breakdown.subscription_momentum ?? breakdown.subscription_hype ?? 50)))

  const items = [
    {
      label: 'Financial Quality (DRHP Analysis)',
      weight: '25%',
      maxPts: 25,
      score: finScore,
      earned: Math.round((finScore * 25) / 100),
      color: 'bg-brand-from',
      textColor: 'text-brand-from',
      icon: FileText,
      description: 'Revenue CAGR, operating cash flow, debt/equity, promoter holding & audit opinion.',
    },
    {
      label: 'Valuation Safety & Pricing Multiples',
      weight: '20%',
      maxPts: 20,
      score: valScore,
      earned: Math.round((valScore * 20) / 100),
      color: 'bg-accent-blue',
      textColor: 'text-accent-blue',
      icon: Target,
      description: 'P/E ratio vs listed peer benchmarks, price-to-book discount, and margin of safety.',
    },
    {
      label: 'GMP Signal (Grey Market Premium)',
      weight: '20%',
      maxPts: 20,
      score: gmpScore,
      earned: Math.round((gmpScore * 20) / 100),
      color: 'bg-accent-green',
      textColor: 'text-accent-green',
      icon: Flame,
      description: 'Realized informal market premium & demand density from investor forums.',
    },
    {
      label: 'Promoter Integrity & Governance',
      weight: '15%',
      maxPts: 15,
      score: govScore,
      earned: Math.round((govScore * 15) / 100),
      color: 'bg-accent-cyan',
      textColor: 'text-accent-cyan',
      icon: Clock,
      description: 'Promoter litigation background, related-party transactions, and clean management history.',
    },
    {
      label: 'Industry Trend & Sector Momentum',
      weight: '10%',
      maxPts: 10,
      score: indScore,
      earned: Math.round((indScore * 10) / 100),
      color: 'bg-accent-purple',
      textColor: 'text-accent-purple',
      icon: TrendingUp,
      description: 'Sector valuation multiples, tailwinds, and recent peer listing gains.',
    },
    {
      label: 'Subscription Hype & Bid Momentum',
      weight: '10%',
      maxPts: 10,
      score: subScore,
      earned: Math.round((subScore * 10) / 100),
      color: 'bg-brand-to',
      textColor: 'text-brand-to',
      icon: MessageSquare,
      description: 'Retail buzz, institutional bid momentum, and media sentiment index.',
    },
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-from" />
        <h3 className="text-sm font-semibold text-text-primary">
          Detailed Dimension Breakdown
        </h3>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const Icon = item.icon

          return (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${item.textColor}`} />
                  <span className="font-semibold text-text-primary">{item.label}</span>
                  <span className="text-2xs font-mono text-text-muted">({item.weight})</span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <span className="font-bold text-text-primary text-xs">
                    {item.earned}
                  </span>
                  <span className="text-text-muted text-xs">
                    / {item.maxPts}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-700`}
                  style={{ width: `${item.score}%` }}
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
