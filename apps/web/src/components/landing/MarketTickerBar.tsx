'use client'

import React from 'react'
import { TrendingUp, Sparkles, Clock, CheckCircle2 } from 'lucide-react'

interface TickerItem {
  name: string
  type: 'index' | 'ipo'
  badge?: string
  badgeColor?: string
  value: string
  change: string
  isPositive: boolean
  detail?: string
}

const TICKER_ITEMS: TickerItem[] = [
  {
    name: 'NIFTY 50',
    type: 'index',
    value: '24,852.15',
    change: '+0.46%',
    isPositive: true,
  },
  {
    name: 'SENSEX',
    type: 'index',
    value: '81,456.80',
    change: '+0.38%',
    isPositive: true,
  },
  {
    name: 'Bonfiglioli Transmissions',
    type: 'ipo',
    badge: 'APPLY • 2d left',
    badgeColor: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
    value: 'GMP +₹142',
    change: '+27.8%',
    isPositive: true,
    detail: 'Score 74/100 • QIB 18.4x',
  },
  {
    name: 'Tonbo Imaging',
    type: 'ipo',
    badge: 'APPLY • 3d left',
    badgeColor: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
    value: 'GMP +₹95',
    change: '+23.5%',
    isPositive: true,
    detail: 'Score 78/100 • NII 12.1x',
  },
  {
    name: 'NTPC Green Energy',
    type: 'ipo',
    badge: 'UPCOMING',
    badgeColor: 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30',
    value: 'GMP +₹14',
    change: '+13.0%',
    isPositive: true,
    detail: 'Score 68/100 • ₹10,000 Cr Issue',
  },
  {
    name: 'Premier Energies',
    type: 'ipo',
    badge: 'ALLOTTED & EXITED',
    badgeColor: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30',
    value: 'Exit ₹850',
    change: '+88.9%',
    isPositive: true,
    detail: 'Realized +₹18,400',
  },
  {
    name: 'Enviro Infra Engineers',
    type: 'ipo',
    badge: 'OPEN TODAY',
    badgeColor: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
    value: 'GMP +₹48',
    change: '+32.4%',
    isPositive: true,
    detail: 'Score 71/100 • Retail 6.8x',
  },
]

export function MarketTickerBar() {
  return (
    <div className="w-full bg-[#14100c] border-b border-[#2d2520] py-2 overflow-hidden relative group">
      {/* Gradient edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#14100c] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#14100c] to-transparent z-10 pointer-events-none" />

      {/* Marquee Container */}
      <div className="flex items-center gap-8 whitespace-nowrap animate-marquee group-hover:[animation-play-state:paused]">
        {/* Render twice for seamless continuous loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="inline-flex items-center gap-3 text-xs px-3 py-1 rounded-lg bg-[#1a1612]/70 border border-[#2d2520]/70 hover:border-[#f59e0b]/40 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium text-[#fafaf9]">
              {item.type === 'index' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              ) : (
                <Sparkles className="w-3 h-3 text-[#f59e0b]" />
              )}
              <span>{item.name}</span>
            </div>

            {item.badge && (
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            )}

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[#d6d3d1]">{item.value}</span>
              <span
                className={`font-semibold flex items-center gap-0.5 ${
                  item.isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'
                }`}
              >
                {item.isPositive ? '▲' : '▼'} {item.change}
              </span>
            </div>

            {item.detail && (
              <span className="text-[11px] text-[#78716c] hidden sm:inline border-l border-[#2d2520] pl-2.5">
                {item.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
