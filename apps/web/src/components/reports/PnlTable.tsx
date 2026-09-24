'use client'

import React from 'react'
import { PnlEntry } from '@/lib/hooks/usePnl'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PnlTableProps {
  entries: PnlEntry[]
}

export function PnlTable({ entries }: PnlTableProps) {
  if (!entries.length) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No completed exits yet. P&L records will appear here after your first listing-day sell.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
            <th className="pb-3 text-left font-medium">IPO</th>
            <th className="pb-3 text-left font-medium">Account</th>
            <th className="pb-3 text-right font-medium">Shares</th>
            <th className="pb-3 text-right font-medium">Issue ₹</th>
            <th className="pb-3 text-right font-medium">Exit ₹</th>
            <th className="pb-3 text-right font-medium">Invested</th>
            <th className="pb-3 text-right font-medium">Realized</th>
            <th className="pb-3 text-right font-medium">Net P&L</th>
            <th className="pb-3 text-right font-medium">ROI %</th>
            <th className="pb-3 text-right font-medium">Exit Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {entries.map((e, idx) => {
            const isWin = e.net_pnl >= 0
            return (
              <tr
                key={idx}
                className="hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="font-semibold text-slate-100">{e.ipo_symbol}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[140px]">{e.ipo_name}</div>
                </td>
                <td className="py-3 pr-4 text-slate-400 text-xs">{e.account_name}</td>
                <td className="py-3 pr-4 text-right text-slate-300">{e.shares_sold}</td>
                <td className="py-3 pr-4 text-right text-slate-400">₹{e.issue_price.toFixed(2)}</td>
                <td className="py-3 pr-4 text-right text-slate-300">₹{e.exit_price.toFixed(2)}</td>
                <td className="py-3 pr-4 text-right text-slate-400">₹{e.invested_amount.toLocaleString('en-IN')}</td>
                <td className="py-3 pr-4 text-right text-slate-300">₹{e.realized_amount.toLocaleString('en-IN')}</td>
                <td className="py-3 pr-4 text-right">
                  <span className={`flex items-center justify-end gap-1 font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isWin ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isWin ? '+' : ''}₹{e.net_pnl.toLocaleString('en-IN')}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isWin ? '+' : ''}{e.roi_percent.toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 text-right text-slate-500 text-xs">{e.exit_date || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
