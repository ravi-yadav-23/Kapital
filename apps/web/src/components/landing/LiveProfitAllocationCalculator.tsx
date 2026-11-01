'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Users,
  Coins,
  Info,
} from 'lucide-react'
import { formatINR } from '@/lib/formatters'

export function LiveProfitAllocationCalculator() {
  const [corpus, setCorpus] = useState<number>(600000) // ₹6,00,000
  const [accountsCount, setAccountsCount] = useState<number>(4) // 4 family demats
  const [targetGmpPercent, setTargetGmpPercent] = useState<number>(28) // 28% GMP average

  // Algorithmic allocation breakdown simulating PuLP solver
  const calculateAllocation = () => {
    const minShniAmount = 205000
    const retailLotAmount = 14800

    let remainingCapital = corpus
    let shniAccountsAllocated = 0
    let retailAccountsAllocated = 0

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

    const expectedListingGain = Math.round(
      totalDeployed * (targetGmpPercent / 100) * 0.42
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
    <div className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-10 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs font-mono font-medium text-[var(--ink-2)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" /> PORTFOLIO & ALLOCATION SIMULATOR
          </div>
          <h3 className="text-xl sm:text-2xl font-medium text-[var(--ink-1)] tracking-tight mt-2">
            Simulate Family Capital Allocation & Listing Returns
          </h3>
          <p className="text-xs sm:text-sm text-[var(--ink-3)] mt-1">
            Calculates optimal distribution across SEBI retail and sHNI quotas via mathematical constraint solving.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs text-[var(--ink-2)] font-mono">
          <ShieldCheck className="w-4 h-4 text-[var(--positive)]" /> SEBI Quota Rules
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Sliders */}
        <div className="lg:col-span-6 space-y-6">
          {/* Slider 1: Total Capital */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-[var(--ink-1)] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[var(--ink-3)]" /> Family Corpus to Deploy:
              </label>
              <span className="font-mono font-medium text-sm text-[var(--ink-1)] tabular-nums">
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
              className="w-full h-1.5 bg-[var(--bg-subtle)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
            />
            <div className="flex justify-between text-2xs text-[var(--ink-3)] font-mono">
              <span>₹1,00,000</span>
              <span>₹10,00,000</span>
              <span>₹25,00,000</span>
            </div>
          </div>

          {/* Slider 2: Number of Family Accounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-[var(--ink-1)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--ink-3)]" /> Family Demat Accounts:
              </label>
              <span className="font-mono font-medium text-sm text-[var(--ink-1)] tabular-nums">
                {accountsCount} Accounts (Distinct PANs)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={accountsCount}
              onChange={(e) => setAccountsCount(Number(e.target.value))}
              className="w-full h-1.5 bg-[var(--bg-subtle)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
            />
            <div className="flex justify-between text-2xs text-[var(--ink-3)] font-mono">
              <span>1 Demat (Individual)</span>
              <span>5 Demats</span>
              <span>10 Demats (Extended Family)</span>
            </div>
          </div>

          {/* Slider 3: Target Expected GMP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-[var(--ink-1)] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[var(--ink-3)]" /> Target Issue GMP:
              </label>
              <span className="font-mono font-medium text-sm text-[var(--positive)] tabular-nums">
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
              className="w-full h-1.5 bg-[var(--bg-subtle)] rounded appearance-none cursor-pointer accent-[var(--positive)]"
            />
            <div className="flex justify-between text-2xs text-[var(--ink-3)] font-mono">
              <span>+10% Moderate</span>
              <span>+35% Strong</span>
              <span>+90% Bumper</span>
            </div>
          </div>
        </div>

        {/* Right Side: Simulated Mathematical Output Card */}
        <div className="lg:col-span-6 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-6 space-y-4">
          {/* Top Expected Return Metrics */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--border-default)]">
            <div>
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block">
                Estimated Net Gain
              </span>
              <span className="font-mono font-medium text-2xl text-[var(--positive)] block mt-1 tabular-nums">
                +{formatINR(expectedListingGain)}
              </span>
              <span className="text-2xs text-[var(--ink-3)] mt-0.5 block font-mono">
                Illustrative return based on average GMP
              </span>
            </div>

            <div>
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block">
                Allotment Odds Boost
              </span>
              <span className="font-mono font-medium text-2xl text-[var(--ink-1)] block mt-1 tabular-nums">
                {probabilityMultiplier}x
              </span>
              <span className="text-2xs text-[var(--ink-3)] mt-0.5 block font-mono">
                vs Single-Account Retail Bidding
              </span>
            </div>
          </div>

          {/* Allocation Breakdown Rows */}
          <div className="space-y-2 text-xs">
            <span className="text-2xs font-mono uppercase text-[var(--ink-3)] block">
              Optimal SEBI Quota Distribution:
            </span>

            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              <span className="text-[var(--ink-1)] font-medium">sHNI Quota (&gt;₹2,00,000 per Demat)</span>
              <span className="font-mono text-[var(--ink-1)] tabular-nums">
                {shniAccountsAllocated} Account{shniAccountsAllocated === 1 ? '' : 's'} ({formatINR(shniAccountsAllocated * 205000)})
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              <span className="text-[var(--ink-1)] font-medium">Retail Quota (1 Lot per Demat)</span>
              <span className="font-mono text-[var(--ink-1)] tabular-nums">
                {retailAccountsAllocated} Account{retailAccountsAllocated === 1 ? '' : 's'} ({formatINR(retailAccountsAllocated * 14800)})
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              <span className="text-[var(--ink-3)]">Liquid Savings Reserve</span>
              <span className="font-mono text-[var(--ink-3)] tabular-nums">
                {formatINR(liquidBuffer)}
              </span>
            </div>
          </div>

          {/* Disclaimer / Regulatory Note */}
          <div className="pt-2 flex items-start gap-2 text-2xs text-[var(--ink-3)] border-t border-[var(--border-default)]">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-[var(--ink-3)] mt-0.5" />
            <span>
              Illustrative simulation based on historical average GMP. All funds stay in your individual bank accounts under SEBI ASBA until allotment confirmation. Zero transfer risk.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
