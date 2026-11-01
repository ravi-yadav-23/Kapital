'use client'

import React from 'react'
import { FamilyAccount } from '@/types'
import { formatINR } from '@/lib/formatters'
import { Edit2 } from 'lucide-react'

interface AccountsTableProps {
  accounts: FamilyAccount[]
  onEditAccount?: (account: FamilyAccount) => void
}

function maskClientId(id: string): string {
  if (!id) return '—'
  if (id.length <= 5) return id
  return `${id.slice(0, 2)}•••${id.slice(-3)}`
}

export function AccountsTable({ accounts, onEditAccount }: AccountsTableProps) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--ink-1)]">
          Accounts ({accounts.length})
        </h3>
        <span className="text-2xs text-[var(--ink-3)] font-mono">
          Angel One SmartAPI · Seeded Demo
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Client ID</th>
              <th className="text-right">Total Balance</th>
              <th className="text-right">Available</th>
              <th className="text-right">In ASBA</th>
              <th>Category</th>
              <th className="text-right">Hit Rate</th>
              <th className="text-right">Realized P&L</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
                    <div>
                      <span className="font-medium text-[var(--ink-1)]">{acc.name}</span>
                      <span className="text-2xs text-[var(--ink-3)] block">{acc.relation}</span>
                    </div>
                  </div>
                </td>

                <td className="font-mono text-2xs text-[var(--ink-2)]">
                  {maskClientId(acc.angel_client_id)}
                </td>

                <td className="text-right font-mono text-xs text-[var(--ink-1)] tabular-nums">
                  {formatINR(acc.total_balance ?? 0)}
                </td>

                <td className="text-right font-mono text-xs text-[var(--ink-1)] tabular-nums">
                  {formatINR(acc.available_balance ?? 0)}
                </td>

                <td className="text-right font-mono text-xs text-[var(--ink-2)] tabular-nums">
                  {(acc.locked_balance ?? 0) > 0 ? (
                    formatINR(acc.locked_balance ?? 0)
                  ) : (
                    <span className="text-[var(--ink-3)]">₹0</span>
                  )}
                </td>

                <td>
                  <span className="px-2 py-0.5 rounded text-2xs font-mono uppercase bg-[var(--bg-subtle)] text-[var(--ink-2)] border border-[var(--border-default)]">
                    {acc.preferred_category}
                  </span>
                </td>

                <td className="text-right font-mono text-xs text-[var(--ink-2)] tabular-nums">
                  {acc.allotment_rate ?? 0}%
                </td>

                <td className="text-right font-mono text-xs text-[var(--positive)] font-medium tabular-nums">
                  {(acc.total_realized_pnl ?? 0) > 0 ? `+${formatINR(acc.total_realized_pnl ?? 0)}` : '₹0'}
                </td>

                <td className="text-right">
                  {onEditAccount && (
                    <button
                      onClick={() => onEditAccount(acc)}
                      className="btn-ghost p-1 text-[var(--ink-3)] hover:text-[var(--ink-1)] inline-flex"
                      title="Edit account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
