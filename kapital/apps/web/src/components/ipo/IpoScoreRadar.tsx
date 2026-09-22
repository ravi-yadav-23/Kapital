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

  // Normalize each dimension to a 0-100 scale for visual balance on the radar chart
  const data = [
    {
      subject: 'Financials (25%)',
      score: Math.round((breakdown.financial_quality / 25) * 100),
      raw: `${breakdown.financial_quality}/25`,
      fullMark: 100,
    },
    {
      subject: 'GMP Signal (20%)',
      score: Math.round((breakdown.gmp_signal / 20) * 100),
      raw: `${breakdown.gmp_signal}/20`,
      fullMark: 100,
    },
    {
      subject: 'Hype & Media (20%)',
      score: Math.round((breakdown.subscription_hype / 20) * 100),
      raw: `${breakdown.subscription_hype}/20`,
      fullMark: 100,
    },
    {
      subject: 'Allotment Prob (15%)',
      score: Math.round((breakdown.allotment_probability / 15) * 100),
      raw: `${breakdown.allotment_probability}/15`,
      fullMark: 100,
    },
    {
      subject: 'Industry Trend (10%)',
      score: Math.round((breakdown.industry_trend / 10) * 100),
      raw: `${breakdown.industry_trend}/10`,
      fullMark: 100,
    },
    {
      subject: 'Lock-in Fit (10%)',
      score: Math.round((breakdown.lock_in_conflict / 10) * 100),
      raw: `${breakdown.lock_in_conflict}/10`,
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
          <p className="text-2xs text-text-secondary">6-factor scoring normalized to 100%</p>
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
                        <span className="text-brand-from font-bold">{item.score}% ({item.raw})</span>
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
