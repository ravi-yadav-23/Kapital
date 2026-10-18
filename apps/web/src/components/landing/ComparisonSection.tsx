'use client'

import React from 'react'
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react'

export function ComparisonSection() {
  const comparisons = [
    {
      feature: 'Prospectus (DRHP) Analysis',
      manual: '2 to 3 hours reading 400-page PDFs, prone to financial ratio blindspots and Telegram hype.',
      kapitl: '30 seconds: Claude 3.5 & Gemini 2.5 Flash agents extract financials, auditor remarks, and peer multiples.',
      highlight: true,
    },
    {
      feature: 'Category & Lot Optimization',
      manual: 'Defaulting to 1-lot Retail (<₹2L) with 4-8% lottery odds, ignoring available family capital.',
      kapitl: 'PuLP constraint solver routes capital into sHNI (>₹2L) and Retail, increasing allotment odds by up to 3.8x.',
      highlight: true,
    },
    {
      feature: 'Family Multi-PAN Management',
      manual: 'Logging in and out of 5+ different broker apps on phone, manual OTP approvals, error-prone.',
      kapitl: 'Single unified dashboard. Distributes bids across 10 linked Angel One accounts in 1 click.',
      highlight: false,
    },
    {
      feature: 'SEBI Duplicate PAN Prevention',
      manual: 'Accidental duplicate bids across different brokers for the same PAN results in 100% rejection.',
      kapitl: 'Pre-flight SEBI PAN deduplication algorithm prevents duplicate bids before UPI block staging.',
      highlight: true,
    },
    {
      feature: 'Listing Day Pre-Open Exit',
      manual: 'Manually watching ticks at 9:55 AM, emotional panic selling, frequent broker app login crashes.',
      kapitl: 'Automated 09:00 AM SmartAPI pre-open limit order execution with target profit capture or trailing stops.',
      highlight: false,
    },
  ]

  return (
    <section className="py-20 border-t border-[#2d2520] bg-[#14100c]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1612] border border-[#2d2520] text-xs font-semibold text-[#f59e0b] mb-4">
            <Sparkles className="w-3.5 h-3.5" /> COMPETITIVE BENCHMARK
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#fafaf9]">
            Manual Broker Bidding vs. Kapitl Autonomous Engine
          </h2>
          <p className="mt-4 text-[#a8a29e] text-base">
            Why algorithmic multi-agent execution consistently captures higher listing gains than manual clicking on Groww or Zerodha.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px] border border-[#2d2520] rounded-2xl overflow-hidden bg-[#1a1612]/80 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="grid grid-cols-12 border-b border-[#2d2520] bg-[#0c0a09]/90 text-xs font-mono uppercase tracking-wider text-[#a8a29e] p-4">
              <div className="col-span-4 font-semibold text-[#fafaf9]">Dimension</div>
              <div className="col-span-4 text-[#ef4444] font-semibold flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Manual Bidding (Groww / Zerodha)
              </div>
              <div className="col-span-4 text-[#22c55e] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Kapitl Autonomous System
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#2d2520]">
              {comparisons.map((row, idx) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-12 p-4 sm:p-5 text-sm transition-colors ${
                    row.highlight ? 'bg-[#1f1a14]/40 hover:bg-[#1f1a14]/70' : 'hover:bg-[#1a1612]'
                  }`}
                >
                  <div className="col-span-4 font-heading font-semibold text-[#fafaf9] pr-4">
                    {row.feature}
                  </div>
                  <div className="col-span-4 text-[#a8a29e] text-xs leading-relaxed pr-4">
                    {row.manual}
                  </div>
                  <div className="col-span-4 text-[#fafaf9] text-xs leading-relaxed font-medium">
                    <span className="text-[#22c55e] font-bold">✓ </span>
                    {row.kapitl}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-[#a8a29e]">
          Engineered for institutional rigor • Tested on NSE/BSE mainboard & SME IPOs • Zero broker vendor lock-in
        </div>
      </div>
    </section>
  )
}
