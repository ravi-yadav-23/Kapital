'use client'

import React, { useState, useEffect } from 'react'
import {
  BrainCircuit,
  SlidersHorizontal,
  Send,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Zap,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Building2,
  Lock,
} from 'lucide-react'

export interface SimulationStep {
  id: number
  title: string
  subtitle: string
  detail: string
  icon: any
  tag: string
  tagColor: string
  badgeText: string
  statLabel: string
  statValue: string
  activeComponent: string
}

const STEPS: SimulationStep[] = [
  {
    id: 1,
    title: 'Multi-Agent DRHP Analysis',
    subtitle: 'Claude 3.5 & Gemini evaluate 400-page prospectus, GMP sentiment & peer multiples in parallel.',
    detail: 'Evaluated 6 dimensions: Financial Quality (82/100), Valuation Multiple (78/100), GMP Surge (+27.8%).',
    icon: BrainCircuit,
    tag: 'STEP 1: AI SCORING',
    tagColor: 'text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10',
    badgeText: 'SCORE 74/100 • APPLY',
    statLabel: 'Verdict',
    statValue: 'Strong Apply (GMP +27.8%)',
    activeComponent: 'agents',
  },
  {
    id: 2,
    title: 'Mathematical Family Allocation',
    subtitle: 'PuLP constraint solver distributes family corpus across 6 accounts to maximize allotment odds.',
    detail: 'Allocated ₹5,80,000 across Ramesh (sHNI: 14 Lots) + Priya (Retail: 1 Lot) + Suresh (sHNI: 14 Lots). Zero duplicate PANs.',
    icon: SlidersHorizontal,
    tag: 'STEP 2: OPTIMIZATION',
    tagColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    badgeText: 'PuLP SOLVER EXECUTED',
    statLabel: 'Expected Gain',
    statValue: '₹42,100 (3.2x odds)',
    activeComponent: 'solver',
  },
  {
    id: 3,
    title: 'ASBA Capital Lock & Mandate Staged',
    subtitle: 'Allocations recorded into broker ASBA tracker; bank funds locked in client savings account.',
    detail: 'Mandates created for ₹5.8L capital. Funds stay in bank earning 3.5% interest until allotment day.',
    icon: Lock,
    tag: 'STEP 3: ASBA LOCK',
    tagColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    badgeText: 'FUNDS SECURED',
    statLabel: 'Capital Locked',
    statValue: '₹5,80,000 across 3 Demats',
    activeComponent: 'asba',
  },
  {
    id: 4,
    title: 'Allotment Detected via Registrar Bot',
    subtitle: 'Registrar scraper checks Link Intime / KFintech APIs every 15 mins on allotment night.',
    detail: 'Allotment confirmed for 1 Lot in Ramesh Demat (sHNI) + 1 Lot in Priya Demat (Retail). Total 58 shares.',
    icon: CheckCircle2,
    tag: 'STEP 4: ALLOTMENT CHECK',
    tagColor: 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10',
    badgeText: '2 LOTS ALLOTTED',
    statLabel: 'Demat Credit',
    statValue: '58 Shares in Angel One',
    activeComponent: 'allotment',
  },
  {
    id: 5,
    title: 'Autonomous Listing Day Exit (09:00 AM)',
    subtitle: 'SmartAPI executes pre-open limit sell order directly at exchange opening tick.',
    detail: 'Sold 58 shares at ₹652 (Issue price ₹510). Profit captured before intraday dip.',
    icon: TrendingUp,
    tag: 'STEP 5: PROFIT REALIZED',
    tagColor: 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10',
    badgeText: '+₹18,400 NET PROFIT',
    statLabel: 'Realized P&L',
    statValue: '+₹18,400 (+27.8% Gain)',
    activeComponent: 'exit',
  },
]

export function LiveArchitectureSimulator() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const activeStep = STEPS[currentStepIndex]

  // Auto-play simulation loop
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % STEPS.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isPlaying])

  return (
    <div className="w-full bg-[#1a1612]/95 border border-[#2d2520] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#f59e0b]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Simulator Control Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2d2520] pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0c0a09] border border-[#2d2520] text-xs font-semibold text-[#f59e0b]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
            LIVE SYSTEM LIFECYCLE SIMULATOR
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[#fafaf9] mt-2">
            Watch Kapitl turn DRHP files into realized bank profits
          </h3>
          <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
            An end-to-end interactive simulation of the autonomous pipeline — from AI ingestion to 9:00 AM profit booking.
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 bg-[#0c0a09] p-1.5 rounded-xl border border-[#2d2520] self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#fafaf9] hover:bg-[#1a1612] transition"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-[#f59e0b]" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#22c55e]" /> Play Live
              </>
            )}
          </button>
          <button
            onClick={() => {
              setCurrentStepIndex(0)
              setIsPlaying(true)
            }}
            className="p-1.5 rounded-lg text-[#a8a29e] hover:text-[#fafaf9] hover:bg-[#1a1612] transition"
            title="Restart simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5-Step Process Bar Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-8">
        {STEPS.map((step, idx) => {
          const isCurrent = idx === currentStepIndex
          const isPassed = idx < currentStepIndex
          const Icon = step.icon

          return (
            <button
              key={step.id}
              onClick={() => {
                setCurrentStepIndex(idx)
                setIsPlaying(false)
              }}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                isCurrent
                  ? 'bg-[#251e18] border-[#f59e0b] shadow-lg shadow-[#f59e0b]/15 scale-[1.02]'
                  : isPassed
                  ? 'bg-[#0c0a09]/80 border-[#2d2520] opacity-80 hover:opacity-100'
                  : 'bg-[#0c0a09]/50 border-[#2d2520]/50 opacity-50 hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono font-bold ${isCurrent ? 'text-[#f59e0b]' : 'text-[#a8a29e]'}`}>
                  0{step.id}
                </span>
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#f59e0b]' : isPassed ? 'text-[#22c55e]' : 'text-[#a8a29e]'}`} />
              </div>
              <div className="text-xs font-bold text-[#fafaf9] line-clamp-1">
                {step.title.split(' ')[0]} {step.title.split(' ')[1]}
              </div>

              {/* Progress active line */}
              {isCurrent && isPlaying && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#f59e0b] to-[#d97706] animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {/* Interactive Simulation Stage View (The Live Animated Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#0c0a09]/90 border border-[#2d2520] rounded-2xl p-6 sm:p-8">
        {/* Stage Left: Detailed Context & Real Metrics */}
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold border ${activeStep.tagColor}">
            {activeStep.tag}
          </div>

          <h4 className="font-heading text-2xl font-bold text-[#fafaf9]">
            {activeStep.title}
          </h4>

          <p className="text-sm text-[#a8a29e] leading-relaxed">
            {activeStep.subtitle}
          </p>

          <div className="p-4 rounded-xl bg-[#1a1612] border border-[#2d2520] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e] font-mono">Live Operation Detail:</span>
              <span className="text-[11px] font-bold text-[#f59e0b] px-2 py-0.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20">
                {activeStep.badgeText}
              </span>
            </div>
            <p className="text-[#fafaf9] font-medium leading-relaxed">
              {activeStep.detail}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#2d2520] text-xs">
            <span className="text-[#a8a29e]">{activeStep.statLabel}:</span>
            <span className="font-bold font-mono text-sm text-[#22c55e]">
              {activeStep.statValue}
            </span>
          </div>
        </div>

        {/* Stage Right: Visual High-Fidelity Animated Micro-UI */}
        <div className="lg:col-span-6">
          <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-5 shadow-inner space-y-4">
            {/* Visual Screen Switcher based on current step */}
            {activeStep.id === 1 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2d2520]">
                  <span className="font-bold text-[#fafaf9] flex items-center gap-1.5">
                    <BrainCircuit className="w-4 h-4 text-[#f59e0b]" /> Autonomous DRHP Audit
                  </span>
                  <span className="text-xs font-mono text-[#22c55e] font-bold">Passed 0 Red Flags</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                    <span className="text-[#a8a29e] block">Balance Sheet Health</span>
                    <span className="text-sm font-bold text-[#fafaf9]">82 / 100</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                    <span className="text-[#a8a29e] block">GMP Sentiment</span>
                    <span className="text-sm font-bold text-[#22c55e]">+27.8% Premium</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-xs text-[#f59e0b] font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  Claude & Gemini Verdict: Strongly recommended for listing gain & long-term holding.
                </div>
              </div>
            )}

            {activeStep.id === 2 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2d2520]">
                  <span className="font-bold text-[#fafaf9] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-blue-400" /> PuLP Constraint Solver
                  </span>
                  <span className="text-xs font-mono text-blue-400 font-bold">10 Demat Accounts</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                    <span className="text-[#a8a29e]">Ramesh (HUF)</span>
                    <span className="font-mono font-bold text-[#fafaf9]">sHNI (14 Lots • ₹2,07,060)</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                    <span className="text-[#a8a29e]">Priya (Individual)</span>
                    <span className="font-mono font-bold text-[#fafaf9]">Retail (1 Lot • ₹14,790)</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                    <span className="text-[#a8a29e]">Suresh (Individual)</span>
                    <span className="font-mono font-bold text-[#fafaf9]">sHNI (14 Lots • ₹2,07,060)</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep.id === 3 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2d2520]">
                  <span className="font-bold text-[#fafaf9] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-purple-400" /> ASBA Bank Fund Lock
                  </span>
                  <span className="text-xs font-mono text-purple-400 font-bold">No Debit Before Allotment</span>
                </div>
                <div className="p-3 rounded-lg bg-[#0c0a09] border border-[#2d2520] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a8a29e]">Savings Account:</span>
                    <span className="font-mono text-[#fafaf9]">HDFC •••• 9350</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a8a29e]">Status:</span>
                    <span className="font-mono text-[#22c55e] font-bold">ASBA Lien Marked (₹5.8L)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a8a29e]">Interest Earning:</span>
                    <span className="font-mono text-[#fafaf9]">Active at 3.5% p.a.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep.id === 4 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2d2520]">
                  <span className="font-bold text-[#fafaf9] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> Registrar Allotment Status
                  </span>
                  <span className="text-xs font-mono text-[#22c55e] font-bold">Match Found!</span>
                </div>
                <div className="p-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 space-y-1.5">
                  <div className="text-xs font-bold text-[#22c55e] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> 58 Shares Allotted (2 Accounts)
                  </div>
                  <p className="text-2xs text-[#a8a29e]">
                    Link Intime PAN lookup confirmed allotment. Shares credited to CDSL depository account.
                  </p>
                </div>
                <div className="flex justify-between text-xs p-2 rounded-lg bg-[#0c0a09] border border-[#2d2520]">
                  <span className="text-[#a8a29e]">ASBA Debit Executed:</span>
                  <span className="font-mono font-bold text-[#fafaf9]">₹29,580 (Remainder unblocked)</span>
                </div>
              </div>
            )}

            {activeStep.id === 5 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2d2520]">
                  <span className="font-bold text-[#fafaf9] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#22c55e]" /> Listing Day 09:00 AM Exit
                  </span>
                  <span className="text-xs font-mono text-[#22c55e] font-bold">Angel One SmartAPI</span>
                </div>
                <div className="p-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-[#22c55e]">
                    <span>Exit Price: ₹652 / share</span>
                    <span>Issue: ₹510</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-[#fafaf9]">
                    Net Listing Profit: +₹18,400 (+27.8%)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0c0a09] border border-[#2d2520] text-2xs text-[#a8a29e] flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#22c55e] flex-shrink-0" />
                  Limit order fired automatically at pre-open session without touching keyboard.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
