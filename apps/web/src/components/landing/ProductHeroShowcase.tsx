'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  SlidersHorizontal,
  Lock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { formatINR } from '@/lib/formatters'

interface ShowcaseStep {
  id: string
  num: string
  title: string
  subtitle: string
  badge: string
}

const SHOWCASE_STEPS: ShowcaseStep[] = [
  {
    id: 'audit',
    num: '01',
    title: 'Forensic DRHP Audit',
    subtitle: 'LLM agents parse 400-page prospectuses, promoter litigation, and live GMP',
    badge: 'AI DUE DILIGENCE',
  },
  {
    id: 'solver',
    num: '02',
    title: 'PuLP Linear Solver',
    subtitle: 'Mathematical constraint solver optimizes lot distribution across family PANs',
    badge: 'MILP OPTIMIZER',
  },
  {
    id: 'asba',
    num: '03',
    title: 'ASBA Mandate Recycling',
    subtitle: 'Tracks bank fund holds and release dates to prevent overlap conflicts',
    badge: 'LIQUIDITY TIMELINE',
  },
  {
    id: 'execution',
    num: '04',
    title: '09:00 AM Listing Sell',
    subtitle: 'SmartAPI executes pre-open limit exit orders at discovery tick',
    badge: 'EXECUTION ENGINE',
  },
]

export function ProductHeroShowcase() {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [simulatedSolveCount, setSimulatedSolveCount] = useState(0)
  const [isSolving, setIsSolving] = useState(false)

  const activeStep = SHOWCASE_STEPS[activeStepIndex]
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-advance loop every 6.5 seconds with smooth progress bar
  useEffect(() => {
    if (isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      return
    }

    const duration = 6500
    const interval = 50
    const stepIncrement = (interval / duration) * 100

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStepIndex((curr) => (curr + 1) % SHOWCASE_STEPS.length)
          return 0
        }
        return prev + stepIncrement
      })
    }, interval)

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [isPaused, activeStepIndex])

  const handleSelectStep = (index: number) => {
    setActiveStepIndex(index)
    setProgress(0)
  }

  const handleTriggerSimulatedSolve = () => {
    setIsSolving(true)
    setTimeout(() => {
      setIsSolving(false)
      setSimulatedSolveCount((c) => c + 1)
    }, 600)
  }

  return (
    <div
      className="w-full max-w-6xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── Desktop Window Frame (Linear / Mercury Style) ───────────────── */}
      <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Window Chrome Title Bar */}
        <div className="h-10 px-4 bg-[var(--bg-base)] border-b border-[var(--border-default)] flex items-center justify-between text-2xs font-mono text-[var(--ink-3)] select-none">
          {/* Mac-Style Window Dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)] inline-block" />
            <span className="ml-2 text-[var(--ink-2)] font-medium">kapitl.app · terminal / live-demo</span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
              <span className="text-[var(--ink-2)]">Live Simulation · 60 FPS</span>
            </span>
            <span>·</span>
            <span>⌘K Omnibar</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
              title={isPaused ? 'Resume auto-play' : 'Pause'}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-[var(--border-default)] bg-[var(--bg-base)] text-xs">
          {SHOWCASE_STEPS.map((s, idx) => {
            const isActive = idx === activeStepIndex
            return (
              <button
                key={s.id}
                onClick={() => handleSelectStep(idx)}
                className={`p-3 text-left transition-colors relative border-r last:border-r-0 border-[var(--border-default)] ${
                  isActive
                    ? 'bg-[var(--bg-surface)] text-[var(--ink-1)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink-2)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-2xs mb-0.5">
                  <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}>
                    {s.num}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider">{s.badge}</span>
                </div>
                <div className="font-medium truncate">{s.title}</div>

                {/* Active Underline Progress Bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--bg-subtle)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-all ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Main Interactive Showcase Viewport ─────────────────────────── */}
        <div className="p-4 sm:p-6 min-h-[380px] sm:min-h-[440px] flex flex-col justify-between bg-[var(--bg-surface)]">
          {/* SCENE 1: AI DRHP DUE DILIGENCE */}
          {activeStep.id === 'audit' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-[var(--ink-1)]">
                      Maxwell Engineering Ltd.
                    </span>
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                      DRHP AUDIT
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-[var(--ink-3)]">
                    Mainboard Issue · Price Band ₹480 - ₹510 · Lot Size 28
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">AI Verdict</span>
                    <span className="text-xs font-mono font-medium text-[var(--positive)]">
                      STRONG APPLY
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-medium text-[var(--ink-1)] tabular-nums">
                    74<span className="text-xs text-[var(--ink-3)]">/100</span>
                  </div>
                </div>
              </div>

              {/* Dimension Score Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2.5">
                  <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">
                    Institutional Dimension Weights
                  </span>

                  {[
                    { name: 'Financial Quality (DRHP)', score: 88, weight: '25%' },
                    { name: 'Valuation Safety & Multiples', score: 90, weight: '20%' },
                    { name: 'Grey Market Premium Signal', score: 95, weight: '20%' },
                    { name: 'Promoter Integrity & Governance', score: 100, weight: '15%' },
                  ].map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-center text-2xs font-mono">
                        <span className="text-[var(--ink-2)]">{d.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--ink-3)] font-sans">({d.weight})</span>
                          <span className="text-[var(--ink-1)] tabular-nums font-medium">
                            {d.score}/100
                          </span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)]"
                          style={{ width: `${d.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Forensic Red Flag Scanner */}
                <div className="p-3.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2.5">
                  <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">
                    Automated Forensic Audit Findings
                  </span>

                  <div className="space-y-2">
                    <div className="p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--ink-1)]">Promoter Pledge Status</span>
                        <span className="font-mono text-[var(--positive)]">0.0% Clean</span>
                      </div>
                      <p className="text-[var(--ink-3)]">No encumbered shares or promoter debt covenants detected.</p>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--ink-1)]">Dilution Structure</span>
                        <span className="font-mono text-[var(--ink-2)]">76% Fresh / 24% OFS</span>
                      </div>
                      <p className="text-[var(--ink-3)]">Capital enters operations rather than early PE investor exit.</p>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--ink-1)]">Auditor Remarks</span>
                        <span className="font-mono text-[var(--positive)]">Unqualified</span>
                      </div>
                      <p className="text-[var(--ink-3)]">Statutory audit notes free from adverse emphasis of matter.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 2: PULP MATHEMATICAL SOLVER */}
          {activeStep.id === 'solver' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-[var(--ink-1)]">
                      Mixed-Integer Linear Solver (MILP)
                    </span>
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                      PuLP CBC · 12ms
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-[var(--ink-3)]">
                    Distributes ₹14,00,000 across 6 Demat accounts to maximize allotment probability
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerSimulatedSolve}
                    disabled={isSolving}
                    className="btn btn-secondary btn-sm gap-1.5 font-mono text-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSolving ? 'animate-spin' : ''}`} />
                    <span>{isSolving ? 'Solving MILP...' : 'Re-Run Solver'}</span>
                  </button>
                  <span className="text-xs font-mono font-medium text-[var(--ink-1)] px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] tabular-nums">
                    Deploying: ₹5,80,000
                  </span>
                </div>
              </div>

              {/* Solver Allocation Table */}
              <div className="overflow-x-auto rounded border border-[var(--border-default)]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--bg-base)] text-[var(--ink-3)] text-2xs uppercase border-b border-[var(--border-default)]">
                    <tr>
                      <th className="p-2.5">Target IPO</th>
                      <th className="p-2.5">Account (PAN)</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Lots</th>
                      <th className="p-2.5 text-right">Capital</th>
                      <th className="p-2.5 text-right">Odds Multiplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {[
                      { ipo: 'Maxwell Eng.', acc: 'Ramesh Yadav (AB•••101)', cat: 'sHNI', lots: '14 lots', cap: 206388, odds: '3.8x' },
                      { ipo: 'Maxwell Eng.', acc: 'Sunita Yadav (CD•••202)', cat: 'RETAIL', lots: '1 lot', cap: 14742, odds: '1.0x' },
                      { ipo: 'Maxwell Eng.', acc: 'Vikram Yadav (EF•••303)', cat: 'RETAIL', lots: '1 lot', cap: 14742, odds: '1.0x' },
                      { ipo: 'Tonbo Imaging', acc: 'Kavita Yadav (GH•••404)', cat: 'sHNI', lots: '14 lots', cap: 206388, odds: '3.4x' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-subtle)] transition-colors">
                        <td className="p-2.5 font-sans font-medium text-[var(--ink-1)]">{row.ipo}</td>
                        <td className="p-2.5 text-[var(--ink-2)]">{row.acc}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-2xs uppercase bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                            {row.cat}
                          </span>
                        </td>
                        <td className="p-2.5 text-right text-[var(--ink-2)] tabular-nums">{row.lots}</td>
                        <td className="p-2.5 text-right font-medium text-[var(--ink-1)] tabular-nums">{formatINR(row.cap)}</td>
                        <td className="p-2.5 text-right text-[var(--positive)] tabular-nums">{row.odds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SCENE 3: ASBA MANDATE RECYCLING */}
          {activeStep.id === 'asba' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-[var(--ink-1)]">
                      ASBA Capital Recycling Timeline
                    </span>
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                      Bank Mandate Holds
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-[var(--ink-3)]">
                    Funds remain in your bank earning 3.5% p.a. interest until allotment confirmation
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">In ASBA Holds</span>
                  <span className="text-sm font-mono font-medium text-[var(--ink-1)] tabular-nums">
                    ₹5,80,000 (3 locks)
                  </span>
                </div>
              </div>

              {/* ASBA Lock Items */}
              <div className="space-y-2.5">
                {[
                  {
                    ipo: 'Maxwell Engineering',
                    acc: 'Ramesh Yadav · sHNI',
                    amount: 206388,
                    blocked: '31 Oct 2026',
                    release: '03 Nov 2026 (in 2 days)',
                    status: 'Active Hold',
                  },
                  {
                    ipo: 'Tonbo Imaging Ltd.',
                    acc: 'Sunita Yadav · Retail',
                    amount: 14742,
                    blocked: '30 Oct 2026',
                    release: '04 Nov 2026 (in 3 days)',
                    status: 'Auto-Rollover',
                  },
                  {
                    ipo: 'Bonfiglioli Transmissions',
                    acc: 'Kavita Yadav · Retail',
                    amount: 14650,
                    blocked: '28 Oct 2026',
                    release: 'Released · Allotted',
                    status: 'Demat Credited',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div>
                      <span className="font-sans font-medium text-[var(--ink-1)] block">{item.ipo}</span>
                      <span className="text-2xs text-[var(--ink-3)]">{item.acc}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-2xs text-[var(--ink-3)] block">Mandate Hold</span>
                        <span className="font-medium text-[var(--ink-1)] tabular-nums">{formatINR(item.amount)}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-2xs text-[var(--ink-3)] block">Release Schedule</span>
                        <span className="text-[var(--ink-2)]">{item.release}</span>
                      </div>

                      <div className="status-pill status-pill-neutral">
                        <span className="status-dot status-dot-positive" />
                        <span>{item.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCENE 4: 09:00 AM LISTING PRE-OPEN EXECUTION */}
          {activeStep.id === 'execution' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-[var(--ink-1)]">
                      09:00:00 AM IST Pre-Market Execution
                    </span>
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--positive)] border border-[var(--positive)]">
                      SmartAPI Connected
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-[var(--ink-3)]">
                    Automated limit orders fired during pre-open discovery tick
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">Realized Listing Gain</span>
                  <span className="text-xl font-mono font-medium text-[var(--positive)] tabular-nums">
                    +₹1,59,570 (+65.4%)
                  </span>
                </div>
              </div>

              {/* Execution Ticker Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-2xs uppercase text-[var(--ink-3)] block">Order Dispatch Time</span>
                  <span className="text-sm font-medium text-[var(--ink-1)] tabular-nums mt-1 block">
                    09:00:00.042 AM
                  </span>
                  <span className="text-2xs text-[var(--positive)] mt-0.5 block">Sub-50ms Exchange Latency</span>
                </div>

                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-2xs uppercase text-[var(--ink-3)] block">Issue Price vs Exit</span>
                  <span className="text-sm font-medium text-[var(--ink-1)] tabular-nums mt-1 block">
                    ₹510 → ₹732 / sh
                  </span>
                  <span className="text-2xs text-[var(--positive)] mt-0.5 block">+43.5% Premium Captured</span>
                </div>

                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-2xs uppercase text-[var(--ink-3)] block">Allotment Win Rate</span>
                  <span className="text-sm font-medium text-[var(--ink-1)] tabular-nums mt-1 block">
                    83.3% Hit Rate
                  </span>
                  <span className="text-2xs text-[var(--ink-3)] mt-0.5 block">5 Allotted out of 6 Bids</span>
                </div>
              </div>

              {/* Staged Execution Feed */}
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs font-mono flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] animate-pulse" />
                  <span className="text-[var(--ink-2)]">
                    Angel SmartAPI Order ANG_IPO_88102 confirmed: 58 shares liquidated at market discovery.
                  </span>
                </div>
                <span className="text-[var(--ink-3)] hidden sm:inline">Executed on NSE</span>
              </div>
            </div>
          )}

          {/* Bottom Control Strip */}
          <div className="pt-3 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-2xs font-mono text-[var(--ink-3)]">
            <div className="flex items-center gap-4">
              <span>Stage: {activeStep.num} / 04</span>
              <span>·</span>
              <span className="text-[var(--ink-2)]">{activeStep.subtitle}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--ink-3)]">Explore live:</span>
              <a
                href="/dashboard"
                className="text-[var(--ink-1)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 font-sans text-xs"
              >
                <span>Demo Workspace</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

