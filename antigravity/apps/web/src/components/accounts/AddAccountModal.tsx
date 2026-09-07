'use client'

import React, { useEffect, useState } from 'react'
import { FamilyAccount, AccountCategory } from '@/types'
import { X, UserPlus, Shield, CheckCircle2 } from 'lucide-react'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onAddAccount: (account: Partial<FamilyAccount>) => void
  initialAccount?: FamilyAccount | null
}

export function AddAccountModal({
  isOpen,
  onClose,
  onAddAccount,
  initialAccount,
}: AddAccountModalProps) {
  const isEdit = Boolean(initialAccount)
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('Self')
  const [clientId, setClientId] = useState('')
  const [balance, setBalance] = useState<number>(300000)
  const [category, setCategory] = useState<AccountCategory>('RETAIL')
  const [maxPct, setMaxPct] = useState<number>(80)

  useEffect(() => {
    if (!isOpen) return
    if (initialAccount) {
      setName(initialAccount.name)
      setRelation(initialAccount.relation || 'Self')
      setClientId(initialAccount.angel_client_id)
      setBalance(initialAccount.available_balance)
      setCategory(initialAccount.preferred_category)
      setMaxPct(initialAccount.max_single_ipo_pct)
    } else {
      setName('')
      setRelation('Self')
      setClientId('')
      setBalance(300000)
      setCategory('RETAIL')
      setMaxPct(80)
    }
  }, [isOpen, initialAccount])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !clientId.trim()) return

    onAddAccount({
      id: initialAccount?.id,
      name: name.trim(),
      relation,
      angel_client_id: clientId.trim().toUpperCase(),
      total_balance: initialAccount
        ? initialAccount.total_balance - initialAccount.available_balance + balance
        : balance,
      available_balance: balance,
      locked_balance: initialAccount?.locked_balance ?? 0,
      preferred_category: category,
      max_single_ipo_pct: maxPct,
      is_active: initialAccount?.is_active ?? true,
      total_applied_ipos: initialAccount?.total_applied_ipos ?? 0,
      total_allotments: initialAccount?.total_allotments ?? 0,
      allotment_rate: initialAccount?.allotment_rate ?? 0,
      total_realized_pnl: initialAccount?.total_realized_pnl ?? 0,
      created_at: initialAccount?.created_at ?? new Date().toISOString(),
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md bg-surface-card border-border-strong shadow-2xl p-6 relative space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-brand-from text-xs font-semibold uppercase tracking-wider">
          <UserPlus className="w-4 h-4" />
          <span>{isEdit ? 'Update Demat Profile' : 'New Demat Registration'}</span>
        </div>

        <div>
          <h2 className="text-base font-bold text-text-primary">
            {isEdit ? 'Edit Family Member Account' : 'Add Family Member Account'}
          </h2>
          <p className="text-2xs text-text-muted">
            Configure Angel One SmartAPI credentials for automatic ASBA order routing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Name & Relation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Yadav"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div>
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
                Relation
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full text-xs"
              >
                <option value="Self">Self</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Spouse">Spouse</option>
                <option value="Sister">Sister</option>
                <option value="Brother">Brother</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Angel Client ID */}
          <div>
            <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
              Angel One Client ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ANGEL_M99412"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full font-mono text-xs uppercase"
            />
          </div>

          {/* Demat Balance */}
          <div>
            <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
              Initial Available Balance (₹)
            </label>
            <input
              type="number"
              min={10000}
              step={10000}
              value={balance}
              onChange={(e) => setBalance(parseInt(e.target.value) || 0)}
              className="w-full font-mono text-xs"
            />
          </div>

          {/* Category Preference */}
          <div>
            <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
              Default Category Preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['RETAIL', 'SHNI', 'BHNI'] as AccountCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`p-2 rounded-lg border text-center font-mono font-bold text-xs transition-all ${
                    category === cat
                      ? 'bg-brand-from/15 border-brand-from text-brand-from'
                      : 'bg-surface-elevated/40 border-border-subtle text-text-muted hover:border-border-default'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="p-2.5 rounded-lg bg-surface-elevated/70 border border-border-subtle text-2xs text-text-muted flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
            <span>Encrypted with local AES-256 vault for TOTP and MPIN.</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1 justify-center"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1 justify-center">
              {isEdit ? 'Save Changes' : 'Register Demat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
