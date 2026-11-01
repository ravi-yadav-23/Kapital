'use client'

import React from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export function ComparisonSection() {
  const comparisons = [
    {
      feature: 'Draft Prospectus (DRHP) Audit',
      manual: '2 to 3 hours reading 400-page PDFs, prone to financial ratio blindspots and Telegram hype.',
      kapitl: '30 seconds: Claude Haiku & Gemini Flash-Lite extract audited financials, promoter litigation, and peer multiples.',
      highlight: true,
    },
    {
      feature: 'SEBI Quota & Lot Optimization',
      manual: 'Defaulting to 1-lot Retail (<₹2L) with low lottery odds, ignoring available family capital.',
      kapitl: 'PuLP constraint solver routes capital into sHNI (>₹2L) and Retail, increasing allotment odds by up to 3.8x.',
      highlight: true,
    },
    {
      feature: 'Family Multi-PAN Management',
      manual: 'Logging in and out of 5+ different broker apps on mobile, manual OTP approvals, error-prone.',
      kapitl: 'Single unified dashboard. Distributes bids across linked Angel One accounts in 1 click.',
      highlight: false,
    },
    {
      feature: 'SEBI Duplicate PAN Prevention',
      manual: 'Accidental duplicate bids across different brokers for the same PAN results in 100% rejection.',
      kapitl: 'Pre-flight SEBI PAN deduplication algorithm prevents duplicate bids before UPI block staging.',
      highlight: true,
    },
    {
      feature: 'Listing Day Pre-Open Exit (09:00 AM)',
      manual: 'Manually watching ticks at 9:55 AM, emotional panic selling, frequent broker app crashes.',
      kapitl: 'Automated 09:00 AM SmartAPI pre-open limit order execution with target profit capture.',
      highlight: false,
    },
  ]

  return (
    <section className="py-16 border-t border-[var(--border-default)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block mb-1">
            Competitive Benchmark
          </span>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--ink-1)]">
            Manual Broker Bidding vs. Kapitl Autonomous System
          </h2>
          <p className="mt-3 text-sm text-[var(--ink-2)] leading-relaxed">
            Why algorithmic multi-agent due diligence and mathematical lot allocation capture higher risk-adjusted listing returns than manual clicking on consumer broker apps.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-base)] text-[var(--ink-3)] text-2xs uppercase font-mono border-b border-[var(--border-default)]">
                <tr>
                  <th className="p-3.5 sm:p-4 font-medium text-[var(--ink-1)] w-1/4">Workflow Dimension</th>
                  <th className="p-3.5 sm:p-4 font-medium text-[var(--negative)] w-3/8">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Manual Bidding (Groww / Zerodha)</span>
                    </span>
                  </th>
                  <th className="p-3.5 sm:p-4 font-medium text-[var(--positive)] w-3/8">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kapitl Autonomous System</span>
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border-default)]">
                {comparisons.map((row) => (
                  <tr
                    key={row.feature}
                    className={`hover:bg-[var(--bg-subtle)] transition-colors ${
                      row.highlight ? 'bg-[var(--bg-elevated)]/30' : ''
                    }`}
                  >
                    <td className="p-3.5 sm:p-4 font-medium text-[var(--ink-1)] align-top">
                      {row.feature}
                    </td>
                    <td className="p-3.5 sm:p-4 text-xs text-[var(--ink-3)] leading-relaxed align-top">
                      {row.manual}
                    </td>
                    <td className="p-3.5 sm:p-4 text-xs text-[var(--ink-2)] leading-relaxed align-top">
                      <span className="text-[var(--positive)] font-medium mr-1.5">✓</span>
                      {row.kapitl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-2xs font-mono text-[var(--ink-3)]">
          Tested on NSE & BSE mainboard and SME public issues · Strictly SEBI Master Circular compliant
        </div>
      </div>
    </section>
  )
}
