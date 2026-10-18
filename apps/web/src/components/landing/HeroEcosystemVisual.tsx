'use client'

import React, { useState, useEffect } from 'react'
import {
  BrainCircuit,
  SlidersHorizontal,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Users,
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
  Zap,
  Activity,
  Layers,
} from 'lucide-react'

export function HeroEcosystemVisual() {
  const [activeTab, setActiveTab] = useState<'card' | 'flow'>('card')
  const [activeGaugeScore, setActiveGaugeScore] = useState(0)
  const [flowPulse, setFlowPulse] = useState(0)

  // Animated score gauge effect on load
  useEffect(() => {
    let current = 0
    const target = 74
    const step = () => {
      current += 2
      if (current >= target) {
        setActiveGaugeScore(target)
      } else {
        setActiveGaugeScore(current)
        requestAnimationFrame(step)
      }
    }
    const timer = setTimeout(() => {
      requestAnimationFrame(step)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Continuous animation pulse for flow view
  useEffect(() => {
    const interval = setInterval(() => {
      setFlowPulse((prev) => (prev + 1) % 4)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-lg bg-[#1a1612]/95 backdrop-blur-2xl border border-[#2d2520] rounded-2xl p-6 shadow-2xl relative group hover:border-[#f59e0b]/40 transition duration-300">
      {/* Top Interactive Toggle Switch */}
      <div className="flex items-center justify-between border-b border-[#2d2520] pb-4 mb-4">
        <div className="flex items-center gap-1.5 p-1 bg-[#0c0a09] border border-[#2d2520] rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('card')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'card'
                ? 'bg-[#f59e0b] text-[#0c0a09] font-bold shadow-sm'
                : 'text-[#a8a29e] hover:text-[#fafaf9]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Issue Score
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'flow'
                ? 'bg-[#f59e0b] text-[#0c0a09] font-bold shadow-sm'
                : 'text-[#a8a29e] hover:text-[#fafaf9]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#0c0a09]" />
            Live Capital Flow
          </button>
        </div>

        <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#22c55e]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          SYSTEM LIVE
        </span>
      </div>

      {activeTab === 'card' ? (
        /* TAB 1: Live Card with Animated Score Gauge & Metrics */
        <div>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] font-medium border border-[#f59e0b]/30">
                  MAINBOARD
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-semibold border border-[#22c55e]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping" />
                  APPLY RECOMMENDED
                </span>
              </div>
              <h3 className="font-heading text-xl font-bold text-[#fafaf9] mt-2">
                Bonfiglioli Transmissions
              </h3>
              <p className="text-xs text-[#a8a29e]">NSE/BSE • ₹480 - ₹510 / share</p>
            </div>

            {/* Score Gauge */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#2d2520]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#f59e0b] transition-all duration-1000 ease-out"
                  strokeDasharray={`${activeGaugeScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-heading font-extrabold text-sm text-[#fafaf9]">
                  {activeGaugeScore}
                </span>
                <span className="text-[9px] text-[#a8a29e] uppercase font-mono">/100</span>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="bg-[#0c0a09]/80 rounded-xl p-3 border border-[#2d2520]">
              <span className="text-[10px] text-[#a8a29e] uppercase tracking-wider block">GMP</span>
              <span className="font-heading font-bold text-sm text-[#22c55e]">+₹142 (27.8%)</span>
            </div>
            <div className="bg-[#0c0a09]/80 rounded-xl p-3 border border-[#2d2520]">
              <span className="text-[10px] text-[#a8a29e] uppercase tracking-wider block">Subscription</span>
              <span className="font-heading font-bold text-sm text-[#fafaf9]">18.4x QIB</span>
            </div>
            <div className="bg-[#0c0a09]/80 rounded-xl p-3 border border-[#2d2520]">
              <span className="text-[10px] text-[#a8a29e] uppercase tracking-wider block">Lot Size</span>
              <span className="font-heading font-bold text-sm text-[#fafaf9]">29 Shares</span>
            </div>
          </div>

          {/* Multi-Agent Breakdown */}
          <div className="space-y-2 pt-2 border-t border-[#2d2520]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a8a29e] flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-[#f59e0b]" /> Fundamental (DRHP Analysis)
              </span>
              <span className="font-medium text-[#fafaf9]">82 / 100</span>
            </div>
            <div className="w-full bg-[#0c0a09] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#f59e0b] h-full rounded-full" style={{ width: '82%' }} />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#a8a29e] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" /> Valuation & Peer PE
              </span>
              <span className="font-medium text-[#fafaf9]">78 / 100</span>
            </div>
            <div className="w-full bg-[#0c0a09] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#22c55e] h-full rounded-full" style={{ width: '78%' }} />
            </div>
          </div>

          {/* Allocation Teaser */}
          <div className="mt-5 pt-3 border-t border-[#2d2520] flex items-center justify-between">
            <span className="text-[11px] text-[#a8a29e] font-mono">
              Allocated across 4 accounts (₹6.0L)
            </span>
            <button
              onClick={() => setActiveTab('flow')}
              className="text-xs font-semibold text-[#f59e0b] flex items-center gap-1 hover:translate-x-0.5 transition cursor-pointer"
            >
              Inspect Flow <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* TAB 2: Live Animated Capital Flow (Groww style moving circuit) */
        <div className="space-y-4">
          <div className="text-xs text-[#a8a29e] flex items-center justify-between">
            <span>Autonomous Pipeline Topology</span>
            <span className="font-mono text-[#f59e0b]">Corpus: ₹6,00,000</span>
          </div>

          {/* Node 1: Family Pool */}
          <div className={`p-3 rounded-xl border transition-all ${
            flowPulse === 0
              ? 'bg-[#f59e0b]/10 border-[#f59e0b] shadow-lg shadow-[#f59e0b]/10'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#f59e0b]" />
                <span className="font-bold text-[#fafaf9]">1. Family Pool (4 Linked PANs)</span>
              </div>
              <span className="font-mono text-[11px] text-[#22c55e]">₹6,00,000 Liquid</span>
            </div>
            <p className="text-[11px] text-[#a8a29e] mt-1">
              Ramesh (PAN 1) • Priya (PAN 2) • Suresh (PAN 3) • Anita (PAN 4)
            </p>
          </div>

          {/* Moving Connection 1 -> 2 */}
          <div className="flex items-center justify-center -my-2 relative z-10">
            <div className="w-0.5 h-5 bg-gradient-to-b from-[#f59e0b] to-[#22c55e] relative">
              <span
                className="absolute w-2 h-2 rounded-full bg-[#f59e0b] -left-[3px] animate-bounce"
                style={{ animationDuration: '1s' }}
              />
            </div>
          </div>

          {/* Node 2: PuLP Constraint Solver */}
          <div className={`p-3 rounded-xl border transition-all ${
            flowPulse === 1
              ? 'bg-[#3b82f6]/10 border-[#3b82f6] shadow-lg shadow-[#3b82f6]/10'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" />
                <span className="font-bold text-[#fafaf9]">2. PuLP Optimization Split</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">
                3.8x ODSS BOOST
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono">
              <div className="p-1.5 bg-[#1a1612] rounded border border-[#2d2520]">
                <span className="text-[#a8a29e] block">2x sHNI (&gt;₹2L):</span>
                <span className="text-[#fafaf9] font-bold">₹4,10,000 (14 Lots/acct)</span>
              </div>
              <div className="p-1.5 bg-[#1a1612] rounded border border-[#2d2520]">
                <span className="text-[#a8a29e] block">2x Retail (&lt;₹2L):</span>
                <span className="text-[#fafaf9] font-bold">₹29,600 (1 Lot/acct)</span>
              </div>
            </div>
          </div>

          {/* Moving Connection 2 -> 3 */}
          <div className="flex items-center justify-center -my-2 relative z-10">
            <div className="w-0.5 h-5 bg-gradient-to-b from-[#38bdf8] to-[#22c55e] relative">
              <span
                className="absolute w-2 h-2 rounded-full bg-[#22c55e] -left-[3px] animate-bounce"
                style={{ animationDuration: '1s' }}
              />
            </div>
          </div>

          {/* Node 3: 09:00 AM Execution & Profit Realizer */}
          <div className={`p-3 rounded-xl border transition-all ${
            flowPulse === 2 || flowPulse === 3
              ? 'bg-[#22c55e]/10 border-[#22c55e] shadow-lg shadow-[#22c55e]/10'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                <span className="font-bold text-[#fafaf9]">3. SmartAPI 9:00 AM Exit</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-semibold">
                AUTONOMOUS
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2d2520] text-xs">
              <span className="text-[#a8a29e]">Estimated Net Listing Gain:</span>
              <span className="font-heading font-extrabold text-[#22c55e] text-sm">
                +₹51,750 (Net Profit)
              </span>
            </div>
          </div>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-[#78716c] font-mono">
              Funds never leave bank account until allotment (SEBI ASBA)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
