'use client'

import React from 'react'
import { PnlEntry } from '@/lib/hooks/usePnl'

interface PnlChartProps {
  entries: PnlEntry[]
}

/**
 * PnlChart — Cumulative P&L bar chart rendered with pure SVG.
 * No recharts / chart.js dependency required.
 * Bars are green for wins, red for losses.
 * Hover tooltip shows IPO symbol + net P&L.
 */
export function PnlChart({ entries }: PnlChartProps) {
  if (!entries.length) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        No P&L data yet
      </div>
    )
  }

  const WIDTH = 600
  const HEIGHT = 200
  const PADDING = { top: 20, right: 16, bottom: 40, left: 60 }
  const plotW = WIDTH - PADDING.left - PADDING.right
  const plotH = HEIGHT - PADDING.top - PADDING.bottom

  const maxAbs = Math.max(...entries.map(e => Math.abs(e.net_pnl)), 1)
  const barW = Math.max(8, Math.floor(plotW / entries.length) - 4)
  const zeroY = PADDING.top + plotH / 2

  const [hovered, setHovered] = React.useState<number | null>(null)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        style={{ minHeight: 140 }}
      >
        {/* Zero line */}
        <line
          x1={PADDING.left}
          y1={zeroY}
          x2={WIDTH - PADDING.right}
          y2={zeroY}
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="4,3"
        />

        {/* Y-axis label */}
        <text x={10} y={PADDING.top + 4} fill="#64748b" fontSize="9" dominantBaseline="hanging">
          +₹{(maxAbs / 1000).toFixed(0)}K
        </text>
        <text x={10} y={HEIGHT - PADDING.bottom} fill="#64748b" fontSize="9">
          -₹{(maxAbs / 1000).toFixed(0)}K
        </text>

        {/* Bars */}
        {entries.map((e, i) => {
          const isWin = e.net_pnl >= 0
          const ratio = e.net_pnl / maxAbs
          const barH = Math.abs(ratio) * (plotH / 2)
          const x = PADDING.left + (i * plotW) / entries.length + (plotW / entries.length - barW) / 2
          const y = isWin ? zeroY - barH : zeroY
          const fill = isWin ? '#10b981' : '#f87171'
          const fillHover = isWin ? '#34d399' : '#fca5a5'

          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx={2}
                fill={hovered === i ? fillHover : fill}
                opacity={0.85}
                style={{ transition: 'fill 0.15s' }}
              />
              {/* X label */}
              <text
                x={x + barW / 2}
                y={HEIGHT - PADDING.bottom + 10}
                fill="#64748b"
                fontSize="8"
                textAnchor="middle"
              >
                {e.ipo_symbol.slice(0, 6)}
              </text>
              {/* Tooltip */}
              {hovered === i && (
                <g>
                  <rect
                    x={Math.min(x - 10, WIDTH - 110)}
                    y={isWin ? y - 36 : y + barH + 4}
                    width={100}
                    height={30}
                    rx={4}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.min(x - 10, WIDTH - 110) + 50}
                    y={isWin ? y - 24 : y + barH + 17}
                    fill="#f1f5f9"
                    fontSize="9"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {e.ipo_symbol}
                  </text>
                  <text
                    x={Math.min(x - 10, WIDTH - 110) + 50}
                    y={isWin ? y - 12 : y + barH + 28}
                    fill={isWin ? '#10b981' : '#f87171'}
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {isWin ? '+' : ''}₹{e.net_pnl.toLocaleString('en-IN')}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
