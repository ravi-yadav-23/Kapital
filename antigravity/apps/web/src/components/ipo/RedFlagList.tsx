'use client'

import React from 'react'
import { RedFlag } from '@/types'
import { ShieldAlert, CheckCircle2, AlertTriangle, ShieldX } from 'lucide-react'

interface RedFlagListProps {
  redFlags?: RedFlag[]
}

export function RedFlagList({ redFlags = [] }: RedFlagListProps) {
  if (!redFlags || redFlags.length === 0) {
    return (
      <div className="card p-4 bg-accent-green/5 border-accent-green/20 space-y-2">
        <div className="flex items-center gap-2 text-accent-green font-semibold text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>Clean DRHP Audit — Zero Red Flags Detected</span>
        </div>
        <p className="text-2xs text-text-secondary">
          Claude's prospectus audit found healthy promoter holding (&gt;50%), positive operating cash
          flows, standard auditor unqualified opinions, and acceptable debt ratios.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3 bg-accent-red/5 border-accent-red/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent-red font-semibold text-xs">
          <ShieldAlert className="w-4 h-4" />
          <span>Automated Red Flags ({redFlags.length})</span>
        </div>
        <span className="text-2xs text-text-muted font-mono uppercase">
          Points Deducted
        </span>
      </div>

      <div className="space-y-2.5">
        {redFlags.map((flag, index) => {
          const isHigh = flag.severity === 'HIGH'
          const isMedium = flag.severity === 'MEDIUM'

          return (
            <div
              key={index}
              className="p-3 rounded-lg bg-surface-card/90 border border-border-subtle flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {isHigh ? (
                  <ShieldX className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                        isHigh
                          ? 'bg-accent-red/15 text-accent-red'
                          : isMedium
                          ? 'bg-accent-amber/15 text-accent-amber'
                          : 'bg-accent-blue/15 text-accent-blue'
                      }`}
                    >
                      {flag.severity} RISK
                    </span>
                  </div>
                  <p className="text-xs text-text-primary mt-1 font-medium leading-snug">
                    {flag.flag}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-xs font-mono font-bold text-accent-red bg-accent-red/10 px-2 py-0.5 rounded">
                  -{flag.penalty} pts
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
