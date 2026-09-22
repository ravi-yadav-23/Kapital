'use client'

import React, { useState } from 'react'
import { Allotment } from '@/types'
import { AmountDisplay } from '../shared/AmountDisplay'
import { PnlDisplay } from '../shared/PnlDisplay'
import { apiClient } from '@/lib/api-client'
import { formatINR, formatDate } from '@/lib/formatters'
import { X, DollarSign, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Send } from 'lucide-react'

interface SellModalProps {
  allotment: Allotment
  isOpen: boolean
  onClose: () => void
}

export function SellModal({ allotment, isOpen, onClose }: SellModalProps) {
  const [sharesToSell, setSharesToSell] = useState<number>(allotment.allotted_shares || 1)
  const defaultLimitPrice =
    allotment.current_price ||
    allotment.listing_price ||
    Math.round((allotment.issue_price || 100) * 1.2)
  const [limitPrice, setLimitPrice] = useState<number>(defaultLimitPrice)
  const [isStaging, setIsStaging] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!isOpen) return null

  const investedForShares = sharesToSell * allotment.issue_price
  const totalSellValue = sharesToSell * limitPrice
  const dpCharge = 15.93 // Angel One Demat debit charge
  const estimatedPnl = totalSellValue - investedForShares - dpCharge
  const estimatedRoi = (estimatedPnl / investedForShares) * 100

  const handleStageOrder = async () => {
    setIsStaging(true)
    try {
      await apiClient.stageSellOrder(allotment.id, limitPrice)
      setIsSuccess(true)
    } catch (err: any) {
      alert(err?.message || 'Failed to stage listing sell order')
    } finally {
      setIsStaging(false)
    }
  }

  const handleClose = () => {
    setIsSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg bg-surface-card border-border-strong shadow-2xl p-6 relative space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="py-6 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center mx-auto shadow-lg shadow-accent-green/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">
                Pre-Listing Limit Sell Order Staged!
              </h3>
              <p className="text-xs text-text-secondary max-w-xs mx-auto">
                Scheduled for execution on <span className="font-semibold text-text-primary">{formatDate(allotment.listing_date)}</span> at{' '}
                <span className="font-mono text-brand-from font-bold">09:00:00 AM IST</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle text-left text-2xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Account:</span>
                <span className="text-text-primary font-bold">{allotment.account_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Quantity:</span>
                <span>{sharesToSell} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Trigger Limit Price:</span>
                <span className="text-accent-green font-bold">₹{limitPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Estimated Realized Gain:</span>
                <span className="text-accent-green font-bold">
                  +{formatINR(estimatedPnl)} ({estimatedRoi.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border-subtle text-2xs text-text-muted text-left flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-from flex-shrink-0" />
              <span>
                Order validity: 30 minutes in pre-market session. Auto-cancels at 09:30 AM if unfilled.
              </span>
            </div>

            <button onClick={handleClose} className="btn btn-primary w-full justify-center">
              Done & Return
            </button>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2 text-accent-green text-xs font-semibold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Pre-Listing Broker Sell Engine</span>
              </div>
              <h2 className="text-lg font-bold text-text-primary mt-1">
                Sell {allotment.ipo_name}
              </h2>
              <div className="flex items-center gap-2 text-2xs text-text-muted font-mono mt-0.5">
                <span>Account: {allotment.account_name}</span>
                <span>•</span>
                <span>Allotted: {allotment.allotted_shares} shares</span>
                <span>•</span>
                <span>Issue: ₹{allotment.issue_price}</span>
              </div>
            </div>

            {/* Shares to sell */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Shares to Liquidate
                </label>
                <button
                  type="button"
                  onClick={() => setSharesToSell(allotment.allotted_shares)}
                  className="text-[10px] font-semibold text-brand-from hover:underline"
                >
                  Sell 100% ({allotment.allotted_shares} shares)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={allotment.allotted_shares}
                  value={sharesToSell}
                  onChange={(e) =>
                    setSharesToSell(
                      Math.min(
                        allotment.allotted_shares,
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    )
                  }
                  className="w-full font-mono font-bold text-sm"
                />
              </div>
            </div>

            {/* Limit Sell Price */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Target Limit Price (₹)
                </label>
                <span className="text-[10px] text-text-muted font-mono">
                  Issue: ₹{allotment.issue_price}
                </span>
              </div>

              <input
                type="number"
                min={allotment.issue_price}
                step={1}
                value={limitPrice}
                onChange={(e) => setLimitPrice(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full font-mono font-bold text-sm text-accent-green"
              />
              <span className="text-[10px] text-text-muted block">
                Calculated with 5% safety buffer under estimated grey market listing price.
              </span>
            </div>

            {/* P&L Estimation Card */}
            <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-2 text-xs">
              <div className="flex justify-between text-text-muted">
                <span>Capital Invested:</span>
                <span className="font-mono text-text-primary">{formatINR(investedForShares)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Gross Realization:</span>
                <span className="font-mono text-text-primary">{formatINR(totalSellValue)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>DP & Demat Charges:</span>
                <span className="font-mono text-text-primary">₹{dpCharge}</span>
              </div>
              <div className="pt-2 border-t border-border-subtle flex justify-between items-center">
                <span className="font-semibold text-text-primary">Estimated Realized Profit:</span>
                <span className="font-mono font-bold text-accent-green text-sm">
                  +{formatINR(estimatedPnl)} ({estimatedRoi.toFixed(1)}% ROI)
                </span>
              </div>
            </div>

            {/* Execution Schedule Note */}
            <div className="p-2.5 rounded-lg bg-surface-elevated/50 border border-border-subtle text-2xs text-text-muted flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-brand-from flex-shrink-0 mt-0.5" />
              <span>
                APScheduler will trigger order via Angel One SmartAPI at <strong>09:00:00 AM IST</strong> on{' '}
                {formatDate(allotment.listing_date)}.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-ghost flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStageOrder}
                disabled={isStaging}
                className="btn btn-primary flex-1 justify-center gap-1.5 font-bold"
              >
                {isStaging ? (
                  <span className="animate-pulse">Staging via SmartAPI...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Stage Pre-Listing Sell</span>
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
