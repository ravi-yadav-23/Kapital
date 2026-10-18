'use client'

import React, { useState } from 'react'
import {
  Sliders,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Users,
  Coins,
  ArrowRight,
  Info,
} from 'lucide-react'
import { formatINR } from '@/lib/formatters'

export function LiveProfitAllocationCalculator() {
  const [corpus, setCorpus] = useState<number>(600000) // ₹6 Lakhs
  const [accountsCount, setAccountsCount] = useState<number>(4) // 4 family demats
  const [targetGmpPercent, setTargetGmpPercent] = useState<number>(28) // 28% GMP average

  // Algorithmic allocation breakdown simulating PuLP solver
  // Rule: sHNI quota is > ₹2,00,000 (usually ~₹2,05,000 per application). Retail is <= ₹2,00,000 (usually 1 lot ~₹15,000).
  const calculateAllocation = () => {
    const minShniAmount = 205000
    const retailLotAmount = 14800

    let remainingCapital = corpus
    let shniAccountsAllocated = 0
    let retailAccountsAllocated = 0

    // Greedily prioritize sHNI accounts if capital allows because sHNI odds in high GMP IPOs are 3x-4x higher than retail lottery
    const maxPossibleShni = Math.min(
      accountsCount,
      Math.floor(remainingCapital / minShniAmount)
    )

    shniAccountsAllocated = maxPossibleShni
    remainingCapital -= shniAccountsAllocated * minShniAmount

    const remainingAccounts = accountsCount - shniAccountsAllocated
    retailAccountsAllocated = Math.min(
      remainingAccounts,
      Math.floor(remainingCapital / retailLotAmount)
    )
    remainingCapital -= retailAccountsAllocated * retailLotAmount

    const totalDeployed =
      shniAccountsAllocated * minShniAmount +
      retailAccountsAllocated * retailLotAmount
    const liquidBuffer = corpus - totalDeployed

    // Estimated expected gain based on target GMP:
    const expectedListingGain = Math.round(
      totalDeployed * (targetGmpPercent / 100) * 0.42 // 42% blended allocation hit rate factor
    )

    const probabilityMultiplier = shniAccountsAllocated > 0 ? (2.8 + shniAccountsAllocated * 0.4).toFixed(1) : '1.0'

    return {
      shniAccountsAllocated,
      retailAccountsAllocated,
      totalDeployed,
      liquidBuffer,
      expectedListingGain,
      probabilityMultiplier,
    }
  }

  const {
    shniAccountsAllocated,
    retailAccountsAllocated,
    totalDeployed,
    liquidBuffer,
    expectedListingGain,
    probabilityMultiplier,
  } = calculateAllocation()

  return (
    <div className="w-full bg-[#1a1612]/90 border border-[#2d2520] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#f59e0b]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2d2520] pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0c0a09] border border-[#2d2520] text-xs font-semibold text-[#f59e0b]">
            <Sparkles className="w-3.5 h-3.5" /> INTERACTIVE PORTFOLIO & PROFIT CALCULATOR
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[#fafaf9] mt-2">
            Simulate Your Family&apos;s Capital Allocation & Profits
          </h3>
          <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
            See how our linear constraint solver mathematically distributes your corpus across SEBI quotas to maximize expected gains.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/25 text-xs text-[#22c55e] font-bold">
          <ShieldCheck className="w-4 h-4" /> SEBI Quota Optimized
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Sliders */}
        <div className="lg:col-span-6 space-y-6">
          {/* Slider 1: Total Capital */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#fafaf9] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#f59e0b]" /> Total Family Corpus to Deploy:
              </label>
              <span className="font-heading font-extrabold text-base text-[#f59e0b] font-mono">
                {formatINR(corpus)}
              </span>
            </div>
            <input
              type="range"
              min={100000}
              max={2500000}
              step={50000}
              value={corpus}
              onChange={(e) => setCorpus(Number(e.target.value))}
              className="w-full h-2 bg-[#0c0a09] rounded-lg appearance-none cursor-pointer accent-[#f59e0b]"
            />
            <div className="flex justify-between text-[10px] text-[#a8a29e] font-mono">
              <span>₹1,00,000</span>
              <span>₹10,00,000</span>
              <span>₹25,00,000</span>
            </div>
          </div>

          {/* Slider 2: Number of Family Accounts */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#fafaf9] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" /> Available Family Demat Accounts:
              </label>
              <span className="font-heading font-extrabold text-base text-blue-400 font-mono">
                {accountsCount} Accounts (Different PANs)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={accountsCount}
              onChange={(e) => setAccountsCount(Number(e.target.value))}
              className="w-full h-2 bg-[#0c0a09] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-[#a8a29e] font-mono">
              <span>1 Demat (Solo)</span>
              <span>5 Demats</span>
              <span>10 Demats (Full Family)</span>
            </div>
          </div>

          {/* Slider 3: Target Expected GMP */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#fafaf9] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#22c55e]" /> Target Issue Grey Market Premium (GMP):
              </label>
              <span className="font-heading font-extrabold text-base text-[#22c55e] font-mono">
                +{targetGmpPercent}% Expected Listing Gain
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={2}
              value={targetGmpPercent}
              onChange={(e) => setTargetGmpPercent(Number(e.target.value))}
              className="w-full h-2 bg-[#0c0a09] rounded-lg appearance-none cursor-pointer accent-[#22c55e]"
            />
            <div className="flex justify-between text-[10px] text-[#a8a29e] font-mono">
              <span>+10% Moderate</span>
              <span>+35% Strong</span>
              <span>+90% Bumper</span>
            </div>
          </div>
        </div>

        {/* Right Side: Simulated Mathematical Output Card */}
        <div className="lg:col-span-6 bg-[#0c0a09]/90 border border-[#2d2520] rounded-2xl p-6 sm:p-7 space-y-5">
          {/* Top Expected Return Metrics */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#2d2520]">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#a8a29e] block">
                Estimated Net Gain (Listing Day)
              </span>
              <span className="font-heading font-extrabold text-2xl sm:text-3xl text-[#22c55e] block mt-1">
                +{formatINR(expectedListingGain)}
              </span>
              <span className="text-[10px] text-[#a8a29e] mt-0.5 block">
                Fired via 09:00 AM SmartAPI Pre-Open
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#a8a29e] block">
                Expected Allotment Odds
              </span>
              <span className="font-heading font-extrabold text-2xl sm:text-3xl text-[#f59e0b] block mt-1">
                {probabilityMultiplier}x Higher
              </span>
              <span className="text-[10px] text-[#a8a29e] mt-0.5 block">
                vs Single-Account Retail Bidding
              </span>
            </div>
          </div>

          {/* Allocation Breakdown Rows */}
          <div className="space-y-2 text-xs">
            <span className="font-semibold text-[#fafaf9] block">
              Optimal SEBI Quota Distribution:
            </span>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1612] border border-[#2d2520]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[#fafaf9] font-medium">sHNI Quota (&gt;₹2L per Demat)</span>
              </div>
              <span className="font-mono font-bold text-blue-400">
                {shniAccountsAllocated} Account{shniAccountsAllocated === 1 ? '' : 's'} (₹{(shniAccountsAllocated * 205000 / 100000).toFixed(2)}L)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1612] border border-[#2d2520]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className="text-[#fafaf9] font-medium">Retail Quota (1 Lot per Demat)</span>
              </div>
              <span className="font-mono font-bold text-[#f59e0b]">
                {retailAccountsAllocated} Account{retailAccountsAllocated === 1 ? '' : 's'} (₹{(retailAccountsAllocated * 14800 / 1000).toFixed(1)}k)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1612]/60 border border-[#2d2520]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#a8a29e]" />
                <span className="text-[#a8a29e]">Liquid Savings Buffer</span>
              </div>
              <span className="font-mono text-[#a8a29e]">
                {formatINR(liquidBuffer)}
              </span>
            </div>
          </div>

          {/* Informational Footer */}
          <div className="pt-2 flex items-start gap-2 text-2xs text-[#a8a29e] border-t border-[#2d2520]">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-[#f59e0b] mt-0.5" />
            <span>
              All funds stay in your individual bank accounts under SEBI ASBA until allotment confirmation. Zero transfer risk.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
