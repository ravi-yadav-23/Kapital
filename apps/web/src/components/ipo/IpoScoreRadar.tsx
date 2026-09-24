'use client'

import React from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ScoreBreakdown } from '@/types'

interface IpoScoreRadarProps {
  breakdown?: ScoreBreakdown
  score?: number
}

export function IpoScoreRadar({ breakdown, score }: IpoScoreRadarProps) {
  if (!breakdown) {
    return (
      <div className="card p-6 text-center text-text-muted text-xs">
        No score breakdown data available.
      </div>
    )
  }

  const finScore = Math.max(0, Math.min(100, Math.round(breakdown.financial_quality ?? 0)))
  const valScore = Math.max(0, Math.min(100, Math.round(breakdown.valuation_safety ?? breakdown.allotment_probability ?? 50)))
  const gmpScore = Math.max(0, Math.min(100, Math.round(breakdown.gmp_strength ?? breakdown.gmp_signal ?? 0)))
  const govScore = Math.max(0, Math.min(100, Math.round(breakdown.promoter_integrity ?? breakdown.lock_in_conflict ?? 60)))
  const indScore = Math.max(0, Math.min(100, Math.round(breakdown.industry_tailwinds ?? breakdown.industry_trend ?? 65)))
  const subScore = Math.max(0, Math.min(100, Math.round(breakdown.subscription_momentum ?? breakdown.subscription_hype ?? 50)))

  // 6 dimensions normalized to 0-100 scale for visual balance on radar chart
  const data = [
    {
      subject: 'Financials (25%)',
      score: finScore,
      raw: `${Math.round((finScore * 25) / 100)}/25`,
      fullMark: 100,
    },
    {
      subject: 'Valuation (20%)',
      score: valScore,
      raw: `${Math.round((valScore * 20) / 100)}/20`,
      fullMark: 100,
    },
    {
      subject: 'GMP Signal (20%)',
      score: gmpScore,
      raw: `${Math.round((gmpScore * 20) / 100)}/20`,
      fullMark: 100,
    },
    {
      subject: 'Governance (15%)',
      score: govScore,
      raw: `${Math.round((govScore * 15) / 100)}/15`,
      fullMark: 100,
    },
    {
      subject: 'Industry (10%)',
      score: indScore,
      raw: `${Math.round((indScore * 10) / 100)}/10`,
      fullMark: 100,
    },
    {
      subject: 'Sentiment (10%)',
      score: subScore,
      raw: `${Math.round((subScore * 10) / 100)}/10`,
      fullMark: 100,
    },
  ]

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Multi-Factor AI Radar
          </h3>
          <p className="text-2xs text-text-secondary">6-factor scoring breakdown</p>
        </div>
        {score !== undefined && (
          <div className="text-right">
            <span className="text-xs font-bold font-mono text-brand-from">
              {score}<span className="text-2xs opacity-70">/100 Total</span>
            </span>
          </div>
        )}
      </div>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(148, 163, 184, 0.15)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload
                  return (
                    <div className="p-2 rounded-lg bg-surface-card border border-border-strong shadow-xl text-2xs space-y-1">
                      <span className="font-semibold text-text-primary block">{item.subject}</span>
                      <div className="flex justify-between gap-3 text-text-secondary font-mono">
                        <span>Score:</span>
                        <span className="text-brand-from font-bold">{item.raw} pts</span>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Radar
              name="IPO Score"
              dataKey="score"
              stroke="#6366f1"
              fill="rgba(99, 102, 241, 0.35)"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
