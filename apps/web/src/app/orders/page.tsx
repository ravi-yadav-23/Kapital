'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { IpoOrder, OrderStatus } from '@/types'
import { formatINR, formatDateTime, getStatusDotClass, getStatusPillClass } from '@/lib/formatters'
import {
  Download,
  Search,
  RotateCcw,
  MoreHorizontal,
  X,
  AlertTriangle,
} from 'lucide-react'

const STATUS_OPTIONS: Array<{ value: 'ALL' | OrderStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending (Intent)' },
  { value: 'APPLIED', label: 'Applied in Broker' },
  { value: 'CONFIRMED', label: 'Confirmed (Staged)' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ALLOTTED', label: 'Allotted' },
  { value: 'NOT_ALLOTTED', label: 'Not Allotted (Refunded)' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

interface ConfirmModalState {
  isOpen: boolean
  orderId: string
  action: 'cancel' | 'delete'
  title: string
  message: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<IpoOrder[]>(() => apiClient.getCachedOrders() || [])
  const [loading, setLoading] = useState(() => (apiClient.getCachedOrders()?.length ?? 0) === 0)
  const [status, setStatus] = useState<'ALL' | OrderStatus>('ALL')
  const [account, setAccount] = useState('ALL')
  const [ipo, setIpo] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const fetchOrders = useCallback(() => {
    apiClient.getOrders().then((data) => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useWebSocketEvent(['ORDER_PLACED', 'ORDER_CANCELLED', 'ORDER_FILLED', 'ORDER_FAILED', 'ALLOTMENT_RESULT', 'ALLOTMENT_DETECTED', 'ASBA_LOCKS_SWEPT'], () => {
    fetchOrders()
  })

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null)
      }
    }
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeMenuId])

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiClient.cancelOrder(orderId)
      fetchOrders()
      setConfirmModal(null)
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order')
    }
  }

  const handleMarkApplied = async (orderId: string) => {
    try {
      await apiClient.markOrderApplied(orderId)
      fetchOrders()
      setActiveMenuId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to mark order as applied')
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await apiClient.deleteOrder(orderId)
      fetchOrders()
      setConfirmModal(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete order')
    }
  }

  const handleAllotmentResult = async (orderId: string, result: 'ALLOTTED' | 'NOT_ALLOTTED') => {
    try {
      await apiClient.setOrderAllotmentResult(orderId, result)
      fetchOrders()
      setActiveMenuId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to update allotment result')
    }
  }

  const accounts = useMemo(
    () => Array.from(new Set(orders.map((o) => o.account_name))).sort(),
    [orders]
  )
  const ipos = useMemo(
    () => Array.from(new Set(orders.map((o) => o.ipo_name))).sort(),
    [orders]
  )

  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    return orders.filter((ord) => {
      if (status !== 'ALL' && ord.status !== status) return false
      if (account !== 'ALL' && ord.account_name !== account) return false
      if (ipo !== 'ALL' && ord.ipo_name !== ipo) return false

      const day = ord.placed_at.slice(0, 10)
      if (datePreset === 'TODAY' && day !== todayStr) return false
      if (datePreset === '7D' && day < sevenDaysAgo) return false
      if (datePreset === '30D' && day < thirtyDaysAgo) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchIpo = ord.ipo_name.toLowerCase().includes(q)
        const matchAcc = ord.account_name.toLowerCase().includes(q)
        const matchOrderId = ord.angel_order_id?.toLowerCase().includes(q)
        if (!matchIpo && !matchAcc && !matchOrderId) return false
      }

      return true
    })
  }, [orders, status, account, ipo, datePreset, searchQuery])

  const exportCsv = () => {
    const headers = ['IPO,Account,Category,Lots,Amount,Status,Angel_Order_ID,Date']
    const rows = filtered.map((o) =>
      `"${o.ipo_name}","${o.account_name}","${o.category}",${o.lots},${o.amount},"${o.status}","${o.angel_order_id}","${o.placed_at}"`
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `kapitl_orders_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const resetFilters = () => {
    setStatus('ALL')
    setAccount('ALL')
    setIpo('ALL')
    setDatePreset('ALL')
    setSearchQuery('')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-[var(--ink-1)] tracking-tight">
              Orders
            </h1>
          </div>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn btn-secondary btn-sm gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Presets */}
            <div className="flex items-center gap-1 text-2xs font-mono">
              {[
                { key: 'ALL', label: 'All Time' },
                { key: 'TODAY', label: 'Today' },
                { key: '7D', label: '7D' },
                { key: '30D', label: '30D' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setDatePreset(p.key as any)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    datePreset === p.key
                      ? 'bg-[var(--bg-subtle)] text-[var(--ink-1)] font-medium border border-[var(--border-strong)]'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search IPO, account, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--border-default)] text-xs">
            <div>
              <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                Account
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full text-xs"
              >
                <option value="ALL">All accounts</option>
                {accounts.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | OrderStatus)}
                className="w-full text-xs"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                IPO
              </label>
              <select
                value={ipo}
                onChange={(e) => setIpo(e.target.value)}
                className="w-full text-xs"
              >
                <option value="ALL">All IPOs</option>
                {ipos.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="btn btn-ghost btn-sm w-full justify-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">
              <div className="card h-48 skeleton border-0" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-xs text-[var(--ink-2)]">No orders match these filters.</p>
              <p className="text-2xs text-[var(--ink-3)] mt-1">
                Try selecting a different status, account, or resetting the date filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Target IPO</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th className="text-right">Lots</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th>Broker Order ID</th>
                    <th>Date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ord) => {
                    const dotClass = getStatusDotClass(ord.status)
                    const isMenuOpen = activeMenuId === ord.id

                    return (
                      <tr key={ord.id} className="relative h-[52px]">
                        <td className="font-medium text-ink">
                          {ord.ipo_name}
                        </td>
                        <td className="text-ink-2">
                          {ord.account_name}
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[13px] font-mono font-medium uppercase bg-surface-raised text-ink-2 border border-line">
                            {ord.category}
                          </span>
                        </td>
                        <td className="text-right font-mono text-[13px] text-ink-2 tabular-nums">
                          {ord.lots}
                        </td>
                        <td className="text-right font-mono text-[13px] text-ink font-medium tabular-nums">
                          {formatINR(ord.amount)}
                        </td>
                        <td>
                          <span className={getStatusPillClass(ord.status)}>
                            <span className={getStatusDotClass(ord.status)} />
                            <span>{ord.status}</span>
                          </span>
                        </td>
                        <td className="font-mono text-[13px] text-ink-3">
                          {ord.angel_order_id || '—'}
                        </td>
                        <td className="font-mono text-[13px] text-ink-3">
                          {formatDateTime(ord.placed_at)}
                        </td>
                        <td className="text-right relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : ord.id)}
                            className="btn-ghost p-1.5 text-ink-3 hover:text-ink inline-flex"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {/* Row Actions Popover Menu */}
                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-8 z-30 w-44 rounded bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-lg py-1 text-left text-xs"
                            >
                              {ord.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkApplied(ord.id)}
                                  className="w-full px-3 py-1.5 text-left text-[var(--ink-1)] hover:bg-[var(--bg-subtle)]"
                                >
                                  Mark Applied
                                </button>
                              )}

                              {['CONFIRMED', 'PENDING', 'SUBMITTED', 'APPLIED'].includes(ord.status) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAllotmentResult(ord.id, 'ALLOTTED')}
                                    className="w-full px-3 py-1.5 text-left text-[var(--positive)] hover:bg-[var(--bg-subtle)]"
                                  >
                                    Mark Allotted
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAllotmentResult(ord.id, 'NOT_ALLOTTED')}
                                    className="w-full px-3 py-1.5 text-left text-[var(--ink-2)] hover:bg-[var(--bg-subtle)]"
                                  >
                                    Mark Not Allotted
                                  </button>
                                  <div className="h-px bg-[var(--border-default)] my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null)
                                      setConfirmModal({
                                        isOpen: true,
                                        orderId: ord.id,
                                        action: 'cancel',
                                        title: 'Cancel IPO Application',
                                        message: `Are you sure you want to cancel the application for ${ord.ipo_name} (${ord.account_name})? Any active ASBA lock will be released.`,
                                      })
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-[var(--negative)] hover:bg-[var(--bg-subtle)]"
                                  >
                                    Cancel Order
                                  </button>
                                </>
                              )}

                              <div className="h-px bg-[var(--border-default)] my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  setConfirmModal({
                                    isOpen: true,
                                    orderId: ord.id,
                                    action: 'delete',
                                    title: 'Delete Order Record',
                                    message: `Permanently delete this order record for ${ord.ipo_name}? This cannot be undone.`,
                                  })
                                }}
                                className="w-full px-3 py-1.5 text-left text-[var(--negative)] hover:bg-[var(--bg-subtle)]"
                              >
                                Delete Record
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="card p-5 max-w-sm w-full space-y-4 bg-[var(--bg-elevated)] border border-[var(--border-strong)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[var(--ink-1)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--negative)] shrink-0" />
                  <h3 className="text-sm font-medium">{confirmModal.title}</h3>
                </div>
                <button
                  onClick={() => setConfirmModal(null)}
                  className="btn-ghost p-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.action === 'cancel') {
                      handleCancelOrder(confirmModal.orderId)
                    } else {
                      handleDeleteOrder(confirmModal.orderId)
                    }
                  }}
                  className="btn btn-destructive btn-sm"
                >
                  Confirm {confirmModal.action === 'cancel' ? 'Cancellation' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
