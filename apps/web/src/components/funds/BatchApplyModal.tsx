'use client'

import React, { useState, useEffect } from 'react'
import { AllocationEntry } from '@/types'
import { apiClient } from '@/lib/api-client'
import { AmountDisplay } from '../shared/AmountDisplay'
import {
  X, Send, CheckCircle2, AlertTriangle, Sparkles,
  Smartphone, ShieldCheck, Info,
} from 'lucide-react'

interface BatchApplyModalProps {
  isOpen: boolean
  onClose: () => void
  entries: AllocationEntry[]
  isDemo?: boolean
  onSuccess?: () => void
}

export function BatchApplyModal({
  isOpen,
  onClose,
  entries,
  isDemo = false,
  onSuccess,
}: BatchApplyModalProps) {
  const [upiVpa, setUpiVpa] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resultSummary, setResultSummary] = useState<{
    succeededCount: number
    failedItems: Array<{ account_id: string; reason: string }>
  } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUpi = localStorage.getItem('kapitl_default_upi')
      if (savedUpi) setUpiVpa(savedUpi)
    }
  }, [isOpen])

  if (!isOpen) return null

  const totalCapital = entries.reduce((sum, e) => sum + (e.amount || 0), 0)
  const totalLots = entries.reduce((sum, e) => sum + (e.lots || 0), 0)

  const handleStageAll = async () => {
    const finalUpi = upiVpa.trim()
    if (!finalUpi || !finalUpi.includes('@') || finalUpi.startsWith('@') || finalUpi.endsWith('@')) {
      setErrorMessage('Please enter a valid UPI VPA handle (e.g. mobile@upi or username@bank) for the ASBA mandate.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('kapitl_default_upi', finalUpi)
      }

      const payload = entries.map((entry) => ({
        account_id: entry.account_id,
        ipo_id: entry.ipo_id,
        category: entry.category,
        lots: entry.lots,
        bid_price: entry.amount > 0 && entry.lots > 0 ? entry.amount / entry.lots : undefined,
        upi_vpa: finalUpi,
      }))

      const res = await apiClient.applyBatchOrders(payload)

      setResultSummary({
        succeededCount: res.succeeded.length,
        failedItems: res.failed,
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ipo:event', {
            detail: { type: 'ORDER_PLACED', payload: { count: res.succeeded.length } },
          })
        )
      }

      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to stage batch IPO applications.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl p-6 space-y-5 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-from/15 text-brand-from flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Stage Optimizer Allocation Plan
              </h2>
              <p className="text-2xs text-text-muted">
                {entries.length} family application{entries.length > 1 ? 's' : ''} across active issues
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {resultSummary ? (
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-xl bg-accent-green/10 border border-accent-green/25 text-accent-green flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {resultSummary.succeededCount} IPO Application{resultSummary.succeededCount > 1 ? 's' : ''} Staged Successfully
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  ASBA capital has been reserved. Please open your UPI app (Google Pay / PhonePe / BHIM) associated with{' '}
                  <span className="font-mono font-medium text-text-primary">{upiVpa}</span> to approve the mandate blocks before issue close.
                </p>
              </div>
            </div>

            {resultSummary.failedItems.length > 0 && (
              <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/25 text-accent-red space-y-1 text-xs">
                <p className="font-semibold">Failed applications ({resultSummary.failedItems.length}):</p>
                <ul className="list-disc pl-4 space-y-0.5 text-2xs">
                  {resultSummary.failedItems.map((f, i) => (
                    <li key={i}>{f.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button onClick={onClose} className="btn btn-primary btn-sm px-5">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Scrollable Plan Summary */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isDemo && (
                <div className="flex items-center gap-2 p-3 bg-brand-from/10 border border-brand-from/25 rounded-xl text-2xs text-text-primary">
                  <Info className="w-4 h-4 text-brand-from flex-shrink-0" />
                  <span>
                    <strong>Demo Simulation Mode:</strong> Submitting will record demo applications and reserve simulated ASBA funds.
                  </span>
                </div>
              )}

              {/* Entries List */}
              <div className="space-y-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                  Application Breakdown
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-surface-base/80 border border-border-subtle flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary truncate">{entry.ipo_name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-3xs font-mono font-bold uppercase ${
                              entry.category?.toUpperCase() === 'SHNI'
                                ? 'bg-accent-blue/15 text-accent-blue'
                                : entry.category?.toUpperCase() === 'BHNI'
                                ? 'bg-accent-purple/15 text-accent-purple'
                                : 'bg-brand-from/15 text-brand-from'
                            }`}
                          >
                            {entry.category}
                          </span>
                        </div>
                        <span className="text-2xs text-text-muted">{entry.account_name} · {entry.lots} lot{entry.lots > 1 ? 's' : ''}</span>
                      </div>
                      <AmountDisplay amount={entry.amount} className="font-mono font-semibold text-xs shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Capital Summary */}
              <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle flex items-center justify-between">
                <div>
                  <span className="text-2xs text-text-muted uppercase font-mono block">Total ASBA Capital Lock</span>
                  <span className="text-2xs text-text-muted">{totalLots} total lots across {entries.length} accounts</span>
                </div>
                <AmountDisplay amount={totalCapital} className="text-base font-bold text-accent-green" />
              </div>

              {/* UPI VPA Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-brand-from" />
                  <span>UPI ID for ASBA Mandate Request</span>
                </label>
                <input
                  type="text"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  placeholder="e.g. 9876543210@upi or yourname@okhdfcbank"
                  className="input w-full font-mono text-xs px-3 py-2 bg-surface-base border border-border-subtle rounded-xl focus:border-brand-from focus:outline-none"
                />
                <p className="text-3xs text-text-muted leading-relaxed">
                  SEBI requires a UPI handle linked to the applicant bank account. A mandate approval notification will arrive in your UPI app.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/25 text-accent-red flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStageAll}
                disabled={isSubmitting || entries.length === 0}
                className="btn btn-primary btn-sm gap-2 shadow-lg shadow-brand-from/20 px-4"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Staging {entries.length} Orders...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Stage All {entries.length} Bids</span>
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

