'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { getRecommendationLabel, getScoreBarColor } from '@/lib/formatters'
import {
  Analysis,
  badgeStyle,
  basisLabel,
  basisNote,
  componentRows,
  confidenceNote,
  factRows,
  orderSignals,
  requestMessage,
} from '@/lib/analysis-view'

interface Props {
  ipoId: string
  /** Also show the score components, red flags and extracted company facts (the AI Reports dossier). */
  detailed?: boolean
}

const DOT: Record<string, string> = {
  negative: 'bg-red-400',
  positive: 'bg-emerald-400',
  neutral: 'bg-ink-3',
}

const SEVERITY: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/40',
  high: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  medium: 'bg-surface text-ink-2 border-line',
}

/** The listing-gain verdict: one score (the same as the IPO list), its reasons and, in detail, what it is built from. */
export function ListingGainPanel({ ipoId, detailed = false }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setAnalysis(await apiClient.getAnalysis(ipoId))
    setLoading(false)
  }, [ipoId])

  useEffect(() => {
    setNotice(null)
    setError(null)
    load()
  }, [load])

  const runAudit = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const out = await apiClient.requestAudit(ipoId)
      setNotice(requestMessage(out.state))
      if (out.state === 'cached') setAnalysis((prev) => ({ ...out, state: prev?.state ?? 'ready' }))
      else setAnalysis((prev) => (prev ? { ...prev, queued: true } : { ...out, state: 'not_analysed', queued: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue the audit.')
    } finally {
      setBusy(false)
    }
  }

  const badge = badgeStyle(analysis?.badge)
  const score = analysis?.score
  const hasScore = score !== null && score !== undefined // same score as the IPO list
  const basis = basisNote(analysis)
  const note = confidenceNote(analysis?.confidence)
  const flags = analysis?.red_flags ?? []
  const flagCodes = new Set(flags.map((f) => f.code))
  const signals = orderSignals(analysis?.signals ?? []).filter((s) => !detailed || !flagCodes.has(s.code))
  const components = componentRows(analysis?.components)
  const facts = factRows(analysis?.facts)
  const docRead = analysis?.state === 'ready' || analysis?.state === 'summary_only' || analysis?.state === 'web_only'

  return (
    <section className="relative p-4 rounded-sm bg-surface-raised border border-line space-y-4" aria-label="Listing-gain analysis">
      {badge && (
        <span className={`absolute top-3 right-3 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide border rounded-sm ${badge.className}`}>
          {badge.label}
        </span>
      )}

      <div className="pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] text-ink-3">Listing-gain score</h3>
          {!loading && (
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">{basisLabel(analysis)}</span>
          )}
        </div>
        {loading ? (
          <p className="text-[13px] text-ink-3 mt-2">Loading…</p>
        ) : hasScore ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[32px] font-mono font-medium leading-none text-ink">{score}</span>
              <span className="text-[13px] font-mono text-ink-3">/ 100</span>
              <span className="text-[13px] text-ink-3">·</span>
              <span className="text-[13px] font-medium text-ink-2">{getRecommendationLabel(analysis?.verdict as never)}</span>
              {analysis?.confidence && analysis.confidence !== 'none' && (
                <span className="text-[12px] text-ink-3">· confidence {analysis.confidence}</span>
              )}
            </div>
            <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full border border-line bg-surface">
              <div className={`h-full ${getScoreBarColor(score!)}`} style={{ width: `${score}%` }} />
            </div>
            {docRead && analysis?.as_of && (
              <p className="mt-2 text-[12px] text-ink-3">Company facts updated {new Date(analysis.as_of).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-ink-2 mt-2">No score yet: there is no grey-market or subscription data and no analysed document for this IPO.</p>
        )}
      </div>

      {basis && <p className="text-[12px] text-ink-3">{basis}</p>}

      {hasScore && signals.length > 0 && (
        <ul className="space-y-2">
          {signals.map((s, i) => (
            <li key={`${s.code}-${i}`} className="flex gap-2 text-[13px] text-ink-2">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${DOT[s.direction] ?? DOT.neutral}`} aria-hidden />
              <span>{s.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {hasScore && note && <p className="text-[12px] text-amber-300/90">{note}</p>}

      {detailed && hasScore && components.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-2">What the score is built from</p>
          {components.map((c) => (
            <div key={c.key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink-2">{c.label}</span>
                <span className="font-mono text-ink">
                  {c.value}/100 <span className="text-ink-3">· weight {c.weightPct}%</span>
                </span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full border border-line bg-surface">
                <div className={`h-full ${getScoreBarColor(c.value)}`} style={{ width: `${c.value}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-ink-3">Inputs that are not known are left out and the others share their weight. Red-flag penalties apply after the average.</p>
        </div>
      )}

      {detailed && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-2">Red flags</p>
          {!docRead ? (
            <p className="text-[12px] text-ink-3">Unknown: no company document has been analysed yet, so the red-flag rules have not run.</p>
          ) : flags.length === 0 ? (
            <p className="text-[12px] text-ink-3">None of the red-flag rules was triggered by the facts found.</p>
          ) : (
            <ul className="space-y-2">
              {flags.map((f, i) => (
                <li key={`${f.code}-${i}`} className="flex items-start gap-2 text-[13px] text-ink-2">
                  <span className={`mt-0.5 shrink-0 rounded-sm border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${SEVERITY[f.severity] ?? SEVERITY.medium}`}>
                    {f.severity}
                  </span>
                  <span className="min-w-0 break-words">{f.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detailed && docRead && facts.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-2">Company facts found</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1 text-[12px]">
                <dt className="text-ink-3">{f.label}</dt>
                <dd className="font-mono text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-ink-3">Only facts that were actually found are listed; anything missing is unknown, not zero.</p>
        </div>
      )}

      {analysis?.state === 'web_only' && (analysis.sources?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-[12px] text-ink-3">Sources</p>
          <ul className="space-y-1">
            {analysis.sources!.map((src, i) => (
              <li key={`${src.url}-${i}`} className="text-[12px] text-ink-2">
                <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all">{src.url}</a>
                <span className="block text-ink-3">&ldquo;{src.quote}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={runAudit}
          disabled={busy || loading || Boolean(analysis?.queued)}
          className="btn-secondary text-[13px] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          <span>{analysis?.queued ? 'Queued for tonight' : busy ? 'Requesting…' : 'Run audit'}</span>
        </button>
        <span className="text-[11px] text-ink-3">Shows the latest analysis, or queues this IPO for tonight’s run (about 02:00 IST).</span>
        {notice && <span className="w-full text-[12px] text-ink-2">{notice}</span>}
        {error && (
          <span className="w-full inline-flex items-center gap-1.5 text-[12px] text-red-300" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
          </span>
        )}
      </div>
    </section>
  )
}
