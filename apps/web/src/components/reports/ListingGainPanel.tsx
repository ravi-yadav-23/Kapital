'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import {
  Analysis,
  badgeStyle,
  basisNote,
  confidenceNote,
  orderSignals,
  requestMessage,
} from '@/lib/analysis-view'

interface Props {
  ipoId: string
}

const DOT: Record<string, string> = {
  negative: 'bg-red-400',
  positive: 'bg-emerald-400',
  neutral: 'bg-ink-3',
}

/** Listing-gain verdict as signals + reasons, with a small Apply / Watch / Avoid badge in the corner. */
export function ListingGainPanel({ ipoId }: Props) {
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
      if (out.state === 'cached') setAnalysis({ ...out, state: 'ready' })
      else setAnalysis((prev) => (prev ? { ...prev, queued: true } : { ...out, state: 'not_analysed', queued: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue the audit.')
    } finally {
      setBusy(false)
    }
  }

  const badge = badgeStyle(analysis?.badge)
  const hasScore = analysis?.score !== null && analysis?.score !== undefined   // same score as the IPO list
  const ready = analysis?.state === 'ready'
  const basis = basisNote(analysis)
  const note = confidenceNote(analysis?.confidence)

  return (
    <section className="relative p-4 rounded-sm bg-surface-raised border border-line space-y-3" aria-label="Listing-gain analysis">
      {badge && (
        <span
          className={`absolute top-3 right-3 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide border rounded-sm ${badge.className}`}
        >
          {badge.label}
        </span>
      )}

      <div>
        <h3 className="text-[13px] text-ink-3">Listing-gain analysis</h3>
        {loading ? (
          <p className="text-[13px] text-ink-3 mt-1">Loading…</p>
        ) : hasScore ? (
          <p className="text-[13px] text-ink-2 mt-1">
            Score <span className="font-mono text-ink">{analysis?.score}</span>
            {ready && analysis?.as_of ? ` · document analysed ${new Date(analysis.as_of).toLocaleDateString()}` : ''}
          </p>
        ) : (
          <p className="text-[13px] text-ink-2 mt-1">
            No score yet: there is no grey-market or subscription data for this IPO.
          </p>
        )}
      </div>

      {basis && <p className="text-[12px] text-ink-3">{basis}</p>}

      {hasScore && (
        <ul className="space-y-2">
          {orderSignals(analysis?.signals ?? []).map((s, i) => (
            <li key={`${s.code}-${i}`} className="flex gap-2 text-[13px] text-ink-2">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${DOT[s.direction] ?? DOT.neutral}`} aria-hidden />
              <span>{s.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {hasScore && note && <p className="text-[12px] text-amber-300/90">{note}</p>}

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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAudit}
          disabled={busy || loading || Boolean(analysis?.queued)}
          className="px-3 py-1.5 text-[13px] rounded-sm border border-line bg-surface hover:bg-surface-raised disabled:opacity-50"
        >
          {analysis?.queued ? 'Queued for tonight' : busy ? 'Requesting…' : 'Run audit'}
        </button>
        {notice && <span className="text-[12px] text-ink-2">{notice}</span>}
        {error && <span className="text-[12px] text-red-300" role="alert">{error}</span>}
      </div>
    </section>
  )
}
