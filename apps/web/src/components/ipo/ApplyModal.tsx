'use client'

import React, { useState, useEffect } from 'react'
import { Ipo, FamilyAccount, AccountCategory } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { formatINR, formatDate } from '@/lib/formatters'
import { apiClient } from '@/lib/api-client'
import { X, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Send, Clock, AlertTriangle } from 'lucide-react'

interface ApplyModalProps {
  ipo: Ipo
  accounts: FamilyAccount[]
  isOpen: boolean
  onClose: () => void
}

export function ApplyModal({ ipo, accounts, isOpen, onClose }: ApplyModalProps) {
  const [category, setCategory] = useState<AccountCategory>('RETAIL')
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [lots, setLots] = useState<number>(1)
  const [upiVpa, setUpiVpa] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const active = accounts.filter((a) => a.is_active !== false)
      if (active.length > 0) {
        setSelectedAccountIds([active[0].id])
      } else if (accounts.length > 0) {
        setSelectedAccountIds([accounts[0].id])
      } else {
        setSelectedAccountIds([])
      }

      apiClient
        .getSettings()
        .then((st: any) => {
          if (st?.default_upi_vpa) {
            setUpiVpa(st.default_upi_vpa)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, accounts])

  if (!isOpen) return null

  const isBiddingOpen = ipo.status === 'open' || ipo.status === 'closing_today'
  const isUpcoming = ipo.status === 'upcoming'
  const isClosed = ipo.status === 'closed' || ipo.status === 'allotted' || ipo.status === 'listed'

  const cutoffPrice = ipo.price_band_max || 100
  const lotSize = ipo.lot_size || 1
  const sharesPerApplication = lots * lotSize
  const amountPerAccount = sharesPerApplication * cutoffPrice
  const totalAmount = amountPerAccount * selectedAccountIds.length

  const isRetailOver = category === 'RETAIL' && amountPerAccount > 200000
  const isShniUnder = category === 'SHNI' && amountPerAccount <= 200000
  const isShniOver = category === 'SHNI' && amountPerAccount > 1000000
  const isBhniUnder = category === 'BHNI' && amountPerAccount <= 1000000
  const hasCategoryViolation = isRetailOver || isShniUnder || isShniOver || isBhniUnder

  const handleCategoryChange = (cat: AccountCategory) => {
    setCategory(cat)
    if (cat === 'RETAIL') {
      setLots(1)
    } else if (cat === 'SHNI') {
      const minLots = Math.ceil(200001 / (lotSize * cutoffPrice))
      setLots(minLots)
    } else if (cat === 'BHNI') {
      const minLots = Math.ceil(1000001 / (lotSize * cutoffPrice))
      setLots(minLots)
    }
  }

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleApply = async () => {
    if (!isBiddingOpen) {
      setErrorMessage(
        `Cannot place bid: ${ipo.name} is currently ${ipo.status.toUpperCase()}. Bidding window opens on ${formatDate(ipo.issue_open_date)} at 10:00 AM IST.`
      )
      return
    }

    const finalUpi = upiVpa.trim()
    if (!finalUpi || !finalUpi.includes('@') || finalUpi.startsWith('@') || finalUpi.endsWith('@')) {
      setErrorMessage('Please provide a valid UPI VPA handle (e.g. mobile@upi or username@bank) for the ASBA mandate.')
      return
    }

    const validAccountIds = selectedAccountIds.filter(Boolean)
    if (validAccountIds.length === 0) {
      setErrorMessage('Please select at least one family demat account to apply.')
      return
    }

    // Category check
    if (isRetailOver) {
      setErrorMessage(`Retail application amount (${formatINR(amountPerAccount)}) exceeds the SEBI ceiling of ₹2,00,000. Please reduce lots or switch to sHNI.`)
      return
    }
    if (isShniUnder || isShniOver) {
      setErrorMessage(`sHNI application amount (${formatINR(amountPerAccount)}) must be between ₹2,00,001 and ₹10,00,000.`)
      return
    }
    if (isBhniUnder) {
      setErrorMessage(`bHNI application amount (${formatINR(amountPerAccount)}) must exceed ₹10,00,000.`)
      return
    }

    // Liquid balance check
    const insufficient = accounts.filter(
      (a) => validAccountIds.includes(a.id) && (a.available_balance || 0) < amountPerAccount
    )
    if (insufficient.length > 0) {
      setErrorMessage(
        `Insufficient liquid balance in: ${insufficient
          .map((a) => `${a.name} (Avail: ${formatINR(a.available_balance || 0)})`)
          .join(', ')}. Required: ${formatINR(amountPerAccount)} per account.`
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const succeeded: string[] = []
    const failed: { name: string; reason: string }[] = []

    try {
      for (const accountId of validAccountIds) {
        const acc = accounts.find((a) => a.id === accountId)
        const accName = acc?.name || accountId
        try {
          await apiClient.applyOrder({
            account_id: accountId,
            ipo_id: ipo.id,
            category: category,
            lots: lots,
            bid_price: cutoffPrice,
            upi_vpa: finalUpi,
          })
          succeeded.push(accName)
        } catch (err: any) {
          failed.push({
            name: accName,
            reason: err.message || 'Failed to stage order',
          })
        }
      }

      if (failed.length === 0) {
        setIsSuccess(true)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ipo:event', {
              detail: { type: 'ORDER_PLACED', payload: { ipo_name: ipo.name, count: succeeded.length } },
            })
          )
        }
      } else if (succeeded.length > 0) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ipo:event', {
              detail: { type: 'ORDER_PLACED', payload: { ipo_name: ipo.name, count: succeeded.length } },
            })
          )
        }
        setErrorMessage(
          `Partially succeeded for: ${succeeded.join(', ')}. Failed for: ${failed
            .map((f) => `${f.name} (${f.reason})`)
            .join('; ')}`
        )
      } else {
        setErrorMessage(
          failed.map((f) => `${f.name}: ${f.reason}`).join(' | ') || 'Failed to place orders.'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setIsSuccess(false)
    setErrorMessage(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg bg-surface-card border-border-strong shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto space-y-5">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center mx-auto shadow-lg shadow-accent-green/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">
                ASBA Application Staged in Tracker!
              </h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Capital allocation and fund locks recorded for{' '}
                <span className="font-semibold text-text-primary">{ipo.name}</span> across{' '}
                {selectedAccountIds.length} account(s).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle text-left text-2xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Total Capital Blocked:</span>
                <span className="text-accent-green font-bold">{formatINR(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Category:</span>
                <span>{category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Lots per Account:</span>
                <span>{lots} ({sharesPerApplication} shares @ ₹{cutoffPrice})</span>
              </div>
            </div>

            {/* SEBI ASBA Regulatory Notice */}
            <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/30 text-2xs text-left space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-accent-amber">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>How to Complete Submission (SEBI ASBA Rule)</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                By SEBI mandate, retail broker trading APIs (including Angel One SmartAPI) only support secondary market trading and <strong>do not permit direct IPO application creation via API</strong>.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Please submit your bid in the <strong>Angel One App &gt; IPO section</strong> (or your bank&apos;s NetBanking ASBA) with <strong>{lots} lot(s) at ₹{cutoffPrice} (Cut-off)</strong>.
              </p>
              <div className="pt-1 text-accent-green font-semibold">
                ✓ Once allotted to your Demat, Kapitl will automatically execute your listing-day limit sell order via SmartAPI at 09:00:00 AM IST.
              </div>
            </div>

            <button onClick={handleClose} className="btn btn-primary w-full justify-center">
              Done & Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 text-brand-from text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Family Allocation Plan & Order Tracker</span>
              </div>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                Allocation Plan for {ipo.name}
              </h2>
              <div className="flex items-center gap-2 text-2xs text-text-muted font-mono mt-0.5">
                <span>Cutoff: ₹{cutoffPrice}</span>
                <span>•</span>
                <span>Lot: {lotSize} shares</span>
              </div>
            </div>

            {/* Upcoming or Closed Notice Banner */}
            {isUpcoming && (
              <div className="p-3.5 rounded-xl bg-accent-blue/10 border border-accent-blue/30 text-xs text-accent-blue space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-accent-blue">
                  <Clock className="w-4 h-4" />
                  <span>Bidding Window Not Yet Open</span>
                </div>
                <p className="text-2xs text-text-secondary leading-relaxed">
                  <strong>{ipo.name}</strong> is an upcoming issue. Indian stock exchanges (NSE/BSE) only accept ASBA retail bids during official market hours (10:00 AM – 5:00 PM IST) starting on <strong>{formatDate(ipo.issue_open_date)}</strong>.
                </p>
              </div>
            )}

            {isClosed && (
              <div className="p-3 rounded-xl bg-surface-elevated border border-border-default text-xs text-text-muted text-center font-semibold">
                This IPO issue is closed. Orders can no longer be submitted.
              </div>
            )}

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-xs text-accent-red flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Application Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['RETAIL', 'SHNI', 'BHNI'] as AccountCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      category === cat
                        ? 'bg-brand-from/15 border-brand-from text-text-primary'
                        : 'bg-surface-elevated/50 border-border-subtle text-text-muted hover:border-border-default'
                    }`}
                  >
                    <div className="text-xs font-bold">{cat}</div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {cat === 'RETAIL' && '≤ ₹2 Lakhs'}
                      {cat === 'SHNI' && '₹2L – ₹10L'}
                      {cat === 'BHNI' && '> ₹10 Lakhs'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accounts Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Select Family Accounts ({selectedAccountIds.length}/{accounts.length})
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAccountIds(
                      selectedAccountIds.length === accounts.length
                        ? []
                        : accounts.map((a) => a.id)
                    )
                  }
                  className="text-[10px] font-semibold text-brand-from hover:underline"
                >
                  {selectedAccountIds.length === accounts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountIds.includes(acc.id)
                  const hasSufficient = acc.available_balance >= amountPerAccount
                  const isActive = acc.is_active !== false

                  return (
                    <label
                      key={acc.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        !isActive
                          ? 'opacity-50 cursor-not-allowed bg-surface-elevated/20 border-border-subtle'
                          : isSelected
                          ? 'bg-surface-elevated border-brand-from/50 text-text-primary cursor-pointer'
                          : 'bg-surface-elevated/30 border-border-subtle text-text-secondary hover:bg-surface-elevated/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isActive}
                          onChange={() => toggleAccount(acc.id)}
                          className="w-4 h-4 rounded border-border-strong text-brand-from focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            <span className="text-[10px] text-text-muted font-normal">
                              ({acc.relation})
                            </span>
                            {!isActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-text-muted">
                            {acc.angel_client_id}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-2xs block text-text-muted">Available:</span>
                        <span
                          className={`text-xs font-mono font-semibold ${
                            hasSufficient ? 'text-accent-green' : 'text-accent-red'
                          }`}
                        >
                          {formatINR(acc.available_balance)}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Lots Input & Calculation */}
            <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border-subtle space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-semibold text-text-primary block">
                    Lots to Apply
                  </label>
                  <span className="text-2xs text-text-muted">
                    {sharesPerApplication} shares @ ₹{cutoffPrice}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLots((prev) => Math.max(1, prev - 1))}
                    className="w-7 h-7 rounded-lg bg-surface-card border border-border-subtle text-text-primary flex items-center justify-center font-bold text-sm hover:bg-surface-elevated"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={lots}
                    onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 text-center font-mono font-bold text-sm py-1 bg-surface-card border-border-subtle"
                  />
                  <button
                    type="button"
                    onClick={() => setLots((prev) => prev + 1)}
                    className="w-7 h-7 rounded-lg bg-surface-card border border-border-subtle text-text-primary flex items-center justify-center font-bold text-sm hover:bg-surface-elevated"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* SEBI Category Guideline Banner */}
              {hasCategoryViolation && (
                <div className="p-2 rounded bg-accent-amber/10 border border-accent-amber/30 text-2xs text-accent-amber flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {isRetailOver && `Exceeds SEBI Retail limit (₹2,00,000). Max ${Math.floor(200000 / (lotSize * cutoffPrice))} lots.`}
                    {isShniUnder && `sHNI requires > ₹2,00,000. Min ${Math.ceil(200001 / (lotSize * cutoffPrice))} lots.`}
                    {isShniOver && `sHNI cannot exceed ₹10,00,000. Switch to bHNI.`}
                    {isBhniUnder && `bHNI requires > ₹10,00,000. Min ${Math.ceil(1000001 / (lotSize * cutoffPrice))} lots.`}
                  </span>
                </div>
              )}

              {/* Total Calculation breakdown */}
              <div className="pt-2 border-t border-border-subtle flex justify-between items-center text-xs">
                <span className="text-text-muted">
                  Total ({selectedAccountIds.length} acc × {formatINR(amountPerAccount)}):
                </span>
                <span className="text-sm font-mono font-bold text-accent-green">
                  {formatINR(totalAmount)}
                </span>
              </div>
            </div>

            {/* UPI ID for ASBA Mandate */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  UPI VPA for ASBA Mandate
                </label>
                <span className="text-[10px] text-text-muted">Mandate request sent to this handle</span>
              </div>
              <input
                type="text"
                value={upiVpa}
                onChange={(e) => setUpiVpa(e.target.value)}
                placeholder="e.g. mobile@upi or username@okhdfcbank"
                className="input w-full font-mono text-xs py-2 bg-surface-card border-border-subtle focus:border-brand-from"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-ghost flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={selectedAccountIds.length === 0 || isSubmitting || !isBiddingOpen || hasCategoryViolation}
                className={`btn flex-1 justify-center gap-2 ${
                  !isBiddingOpen || hasCategoryViolation
                    ? 'btn-ghost opacity-60 cursor-not-allowed text-text-muted'
                    : 'btn-primary'
                }`}
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Recording ASBA Lock...</span>
                ) : isUpcoming ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Opens {formatDate(ipo.issue_open_date)}</span>
                  </>
                ) : isClosed ? (
                  <span>Issue Closed</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Record & Lock ASBA Funds</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
