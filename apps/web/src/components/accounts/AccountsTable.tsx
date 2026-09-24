'use client'

import React from 'react'
import { FamilyAccount } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { ShieldCheck, User, TrendingUp, MoreVertical, Edit2 } from 'lucide-react'

interface AccountsTableProps {
  accounts: FamilyAccount[]
  onEditAccount?: (account: FamilyAccount) => void
}

export function AccountsTable({ accounts, onEditAccount }: AccountsTableProps) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-brand-from" />
          <h3 className="text-sm font-semibold text-text-primary">
            Family Member Demat Accounts ({accounts.length})
          </h3>
        </div>
        <span className="text-2xs text-text-muted font-mono">
          Angel One SmartAPI Synced
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Angel Client ID</th>
              <th>Total Demat Value</th>
              <th>Available (Liquid)</th>
              <th>ASBA Blocked</th>
              <th>Category</th>
              <th>Hit Rate</th>
              <th>Realized P&L</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-surface-elevated/70 transition-colors">
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-from/15 text-brand-from flex items-center justify-center font-bold text-xs">
                      {acc.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary flex items-center gap-1.5">
                        <span>{acc.name}</span>
                        {acc.is_active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block" title="Active" />
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted">{acc.relation}</span>
                    </div>
                  </div>
                </td>

                <td className="font-mono text-2xs text-text-secondary">
                  {acc.angel_client_id}
                </td>

                <td>
                  <AmountDisplay amount={acc.total_balance ?? 0} className="text-xs font-semibold" />
                </td>

                <td>
                  <AmountDisplay
                    amount={acc.available_balance ?? 0}
                    className="text-xs font-semibold text-accent-green"
                  />
                </td>

                <td>
                  {(acc.locked_balance ?? 0) > 0 ? (
                    <AmountDisplay
                      amount={acc.locked_balance ?? 0}
                      className="text-xs font-semibold text-accent-amber"
                    />
                  ) : (
                    <span className="text-2xs font-mono text-text-muted">₹0 (Free)</span>
                  )}
                </td>


                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      acc.preferred_category === 'BHNI'
                        ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
                        : acc.preferred_category === 'SHNI'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                        : 'bg-brand-from/15 text-brand-from border border-brand-from/30'
                    }`}
                  >
                    {acc.preferred_category}
                  </span>
                </td>

                <td>
                  <div className="flex items-center gap-1 font-mono text-2xs">
                    <span className="font-bold text-text-primary">{(acc.allotment_rate ?? 0)}%</span>
                    <span className="text-text-muted">({(acc.total_allotments ?? 0)}/{(acc.total_applied_ipos ?? 0)})</span>
                  </div>
                </td>

                <td>
                  <span className="text-accent-green font-mono font-bold text-xs">
                    +₹{(acc.total_realized_pnl ?? 0).toLocaleString('en-IN')}
                  </span>
                </td>

                <td>
                  {onEditAccount ? (
                    <button
                      onClick={() => onEditAccount(acc)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-card transition-colors"
                      title="Edit Account Config"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-card transition-colors">
                      <MoreVertical className="w-3.5 h-3.5" />
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
