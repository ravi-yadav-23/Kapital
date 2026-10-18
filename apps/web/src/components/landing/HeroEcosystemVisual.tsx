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

  // Continuous animation pulse for the 3 stages
  useEffect(() => {
    const interval = setInterval(() => {
      setFlowPulse((prev) => (prev + 1) % 3)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-lg bg-[#1a1612]/95 backdrop-blur-2xl border border-[#2d2520] rounded-2xl p-5 sm:p-6 shadow-2xl relative group hover:border-[#f59e0b]/40 transition duration-300">
      {/* ── TOP: Live Active Issue Header & AI Score ── */}
      <div className="border-b border-[#2d2520] pb-4 mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] font-medium border border-[#f59e0b]/30">
              MAINBOARD
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-semibold border border-[#22c55e]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping" />
              APPLY RECOMMENDED
            </span>
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#22c55e]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            LIVE PIPELINE
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg sm:text-xl font-bold text-[#fafaf9] tracking-tight">
              Bonfiglioli Transmissions
            </h3>
            <p className="text-xs text-[#a8a29e]">NSE/BSE • ₹480 - ₹510 / share</p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-mono font-bold text-[#22c55e] px-2 py-0.5 rounded bg-[#22c55e]/10 border border-[#22c55e]/25">
                GMP +₹142 (+27.8%)
              </span>
              <span className="text-[11px] font-mono text-[#fafaf9] px-2 py-0.5 rounded bg-[#0c0a09] border border-[#2d2520]">
                18.4x QIB
              </span>
            </div>
          </div>

          {/* Radial Score Gauge */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
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
              <span className="font-heading font-extrabold text-xs sm:text-sm text-[#fafaf9]">
                {activeGaugeScore}
              </span>
              <span className="text-[8px] text-[#a8a29e] uppercase font-mono">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Autonomous Capital Allocation Flow (Visible without clicking) ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-[11px] text-[#a8a29e] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-[#f59e0b] font-bold">
            <Zap className="w-3.5 h-3.5" /> Capital & Profit Route
          </span>
          <span>Corpus: ₹6,00,000</span>
        </div>

        {/* Node 1: Family Pool */}
        <div
          className={`p-3 rounded-xl border transition-all duration-300 ${
            flowPulse === 0
              ? 'bg-[#f59e0b]/15 border-[#f59e0b] shadow-lg shadow-[#f59e0b]/10 scale-[1.01]'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#f59e0b]" />
              <span className="font-bold text-[#fafaf9]">1. Family Pool (4 Linked Demats)</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[#22c55e]">₹6,00,000 Liquid</span>
          </div>
          <p className="text-[11px] text-[#a8a29e] mt-1 font-mono">
            Ramesh (PAN 1) • Priya (PAN 2) • Suresh (PAN 3) • Anita (PAN 4)
          </p>
        </div>

        {/* Animated Connector Pulse 1 -> 2 */}
        <div className="flex items-center justify-center -my-2 relative z-10">
          <div className="w-0.5 h-4 bg-gradient-to-b from-[#f59e0b] to-[#38bdf8] relative">
            <span
              className="absolute w-2 h-2 rounded-full bg-[#f59e0b] -left-[3px] animate-bounce"
              style={{ animationDuration: '1.2s' }}
            />
          </div>
        </div>

        {/* Node 2: PuLP Constraint Solver Optimization */}
        <div
          className={`p-3 rounded-xl border transition-all duration-300 ${
            flowPulse === 1
              ? 'bg-[#38bdf8]/15 border-[#38bdf8] shadow-lg shadow-[#38bdf8]/10 scale-[1.01]'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" />
              <span className="font-bold text-[#fafaf9]">2. PuLP Optimization Split</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
              3.8x ODDS BOOST
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono">
            <div className="p-1.5 bg-[#1a1612] rounded-lg border border-[#2d2520]">
              <span className="text-[#a8a29e] block font-medium">2x sHNI (&gt;₹2L):</span>
              <span className="text-[#fafaf9] font-bold">₹4,10,000 (14 Lots/acct)</span>
            </div>
            <div className="p-1.5 bg-[#1a1612] rounded-lg border border-[#2d2520]">
              <span className="text-[#a8a29e] block font-medium">2x Retail (&le;₹2L):</span>
              <span className="text-[#fafaf9] font-bold">₹29,600 (1 Lot/acct)</span>
            </div>
          </div>
        </div>

        {/* Animated Connector Pulse 2 -> 3 */}
        <div className="flex items-center justify-center -my-2 relative z-10">
          <div className="w-0.5 h-4 bg-gradient-to-b from-[#38bdf8] to-[#22c55e] relative">
            <span
              className="absolute w-2 h-2 rounded-full bg-[#22c55e] -left-[3px] animate-bounce"
              style={{ animationDuration: '1.2s' }}
            />
          </div>
        </div>

        {/* Node 3: SmartAPI 9:00 AM Exit & Profit Realized */}
        <div
          className={`p-3 rounded-xl border transition-all duration-300 ${
            flowPulse === 2
              ? 'bg-[#22c55e]/15 border-[#22c55e] shadow-lg shadow-[#22c55e]/15 scale-[1.01]'
              : 'bg-[#0c0a09] border-[#2d2520]'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22c55e]" />
              <span className="font-bold text-[#fafaf9]">3. SmartAPI 9:00 AM Pre-Open Exit</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold border border-[#22c55e]/30">
              AUTONOMOUS
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2d2520] text-xs">
            <span className="text-[#a8a29e]">Estimated Net Listing Profit:</span>
            <span className="font-heading font-extrabold text-[#22c55e] text-sm sm:text-base">
              +₹51,750 (Realized)
            </span>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-[#78716c] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
          <span>Funds never leave bank account until allotment (SEBI ASBA)</span>
        </div>
      </div>
    </div>
  )
}
