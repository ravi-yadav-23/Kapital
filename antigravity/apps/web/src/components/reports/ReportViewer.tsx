'use client'

import React from 'react'
import { AiReport } from '@/types'
import { ScoreBadge } from '../shared/ScoreBadge'
import { RedFlagList } from '../ipo/RedFlagList'
import { IpoScoreBreakdown } from '../ipo/IpoScoreBreakdown'
import { formatDateTime } from '@/lib/formatters'
import { getRecommendationLabel } from '@/lib/formatters'
import { Sparkles, ShieldCheck, Newspaper, Scale } from 'lucide-react'

interface ReportViewerProps {
  report: AiReport
}

export function ReportViewer({ report }: ReportViewerProps) {
  return (
    <div className="card p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
            AI due diligence
          </p>
          <h2 className="text-lg font-bold text-text-primary">
            {report.ipo_name}{' '}
            <span className="font-mono text-sm text-text-muted">({report.ipo_symbol})</span>
          </h2>
          <p className="text-2xs text-text-muted font-mono mt-0.5">
            Generated {formatDateTime(report.generated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={report.score} size="lg" />
          <span className="px-2 py-1 rounded text-2xs font-semibold bg-brand-from/15 text-brand-from border border-brand-from/30">
            {getRecommendationLabel(report.recommendation)}
          </span>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Sparkles className="w-3.5 h-3.5 text-brand-from" />
          Score Summary
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">{report.score_summary}</p>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
          Financial Quality (Claude)
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">{report.financial_quality}</p>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Newspaper className="w-3.5 h-3.5 text-accent-amber" />
          GMP & Sentiment (Gemini)
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">{report.gmp_sentiment}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-text-primary">Red Flags</h3>
        {report.red_flags.length === 0 ? (
          <p className="text-2xs text-accent-green">No material red flags in the DRHP pass.</p>
        ) : (
          <RedFlagList redFlags={report.red_flags} />
        )}
      </section>

      <IpoScoreBreakdown breakdown={report.score_breakdown} />

      <section className="space-y-2 p-3 rounded-lg bg-surface-elevated/70 border border-border-subtle">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Scale className="w-3.5 h-3.5 text-brand-to" />
          Final Recommendation
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">{report.final_reasoning}</p>
      </section>
    </div>
  )
}
