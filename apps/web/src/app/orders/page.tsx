'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import { useWebSocketEvent } from '@/lib/hooks/useWebSocket'
import { IpoOrder, OrderStatus } from '@/types'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatINR, formatDateTime } from '@/lib/formatters'
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  Ban,
  RotateCcw,
  Download,
  Search,
  Filter,
  Trash2,
} from 'lucide-react'

const STATUS_OPTIONS: Array<{ value: 'ALL' | OrderStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending (Intent Recorded)' },
  { value: 'APPLIED', label: 'Applied in Broker' },
  { value: 'CONFIRMED', label: 'Confirmed (Staged)' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ALLOTTED', label: 'Allotted' },
  { value: 'NOT_ALLOTTED', label: 'Not Allotted (Refunded)' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<
    string,
    { className: string; icon: React.ReactNode }
  > = {
    PENDING: {
      className: 'text-accent-amber bg-accent-amber/10 border border-accent-amber/30',
      icon: <Clock className="w-3 h-3" />,
    },
    APPLIED: {
      className: 'text-accent-blue bg-accent-blue/10 border border-accent-blue/30',
      icon: <Send className="w-3 h-3" />,
    },
    SUBMITTED: {
      className: 'text-accent-blue bg-accent-blue/10 border border-accent-blue/30',
      icon: <Send className="w-3 h-3" />,
    },
    CONFIRMED: {
      className: 'text-accent-green bg-accent-green/10 border border-accent-green/30',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    ALLOTTED: {
      className: 'text-brand-from bg-brand-from/15 border border-brand-from/30',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    NOT_ALLOTTED: {
      className: 'text-text-muted bg-surface-elevated border border-border-subtle',
      icon: <XCircle className="w-3 h-3 text-text-muted" />,
    },
    REJECTED: {
      className: 'text-accent-red bg-accent-red/10 border border-accent-red/30',
      icon: <XCircle className="w-3 h-3" />,
    },
    CANCELLED: {
      className: 'text-text-muted bg-surface-elevated border border-border-subtle',
      icon: <Ban className="w-3 h-3" />,
    },
  }
  const cfg = map[status] || {
    className: 'text-text-muted bg-surface-elevated border border-border-subtle',
    icon: <Clock className="w-3 h-3" />,
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}
    >
      {cfg.icon}
      <span>{status}</span>
    </span>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<IpoOrder[]>(() => apiClient.getCachedOrders() || [])
  const [loading, setLoading] = useState(() => (apiClient.getCachedOrders()?.length ?? 0) === 0)
  const [status, setStatus] = useState<'ALL' | OrderStatus>('ALL')
  const [account, setAccount] = useState('ALL')
  const [ipo, setIpo] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL')

  const fetchOrders = useCallback(() => {
    apiClient.getOrders().then((data) => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useWebSocketEvent(['ORDER_PLACED', 'ORDER_FILLED', 'ORDER_FAILED', 'ALLOTMENT_DETECTED'], () => {
    fetchOrders()
  })

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiClient.cancelOrder(orderId)
      const data = await apiClient.getOrders()
      setOrders(data)
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order')
    }
  }

  const handleMarkApplied = async (orderId: string) => {
    try {
      await apiClient.markOrderApplied(orderId)
      const data = await apiClient.getOrders()
      setOrders(data)
    } catch (err: any) {
      alert(err.message || 'Failed to mark order as applied')
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Remove this application record from history? Any associated ASBA locked balance will be restored.')) return
    try {
      await apiClient.deleteOrder(orderId)
      const data = await apiClient.getOrders()
      setOrders(data)
    } catch (err: any) {
      alert(err.message || 'Failed to delete order')
    }
  }

  const handleAllotmentResult = async (orderId: string, result: 'ALLOTTED' | 'NOT_ALLOTTED') => {
    try {
      await apiClient.setOrderAllotmentResult(orderId, result)
      const data = await apiClient.getOrders()
      setOrders(data)
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
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-from" />
              <span>Order & Application Tracker</span>
            </h1>
            <p className="page-subtitle">
              Track ASBA capital allocation, manual broker submissions, and allotment outcomes
            </p>
          </div>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn btn-ghost btn-sm gap-1.5 text-xs border-border-subtle hover:text-text-primary"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="card p-4 space-y-3 bg-surface-card border-border-default">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Presets */}
            <div className="flex items-center gap-1.5 text-2xs font-semibold">
              {[
                { key: 'ALL', label: 'All Time' },
                { key: 'TODAY', label: 'Today' },
                { key: '7D', label: 'Last 7 Days' },
                { key: '30D', label: 'Last 30 Days' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setDatePreset(p.key as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    datePreset === p.key
                      ? 'bg-brand-from/15 text-brand-from border border-brand-from/30'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search IPO, account, order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-surface-elevated border-border-subtle"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-border-subtle text-xs">
            <div>
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
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
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
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
              <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
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
                className="btn btn-ghost btn-sm w-full justify-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="card space-y-3 p-0 overflow-hidden bg-surface-card border-border-default">
          {loading ? (
            <div className="p-6">
              <div className="card h-48 skeleton border-0" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No orders match these filters"
              message="Try another status, account, IPO, or date range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IPO</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th>Lots</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Angel Order ID</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ord) => (
                    <tr key={ord.id}>
                      <td className="font-semibold text-text-primary">{ord.ipo_name}</td>
                      <td>{ord.account_name}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-surface-elevated text-text-accent">
                          {ord.category}
                        </span>
                      </td>
                      <td>{ord.lots}</td>
                      <td className="font-semibold text-text-primary">
                        {formatINR(ord.amount)}
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          <OrderStatusBadge status={ord.status} />
                          {ord.reject_reason && (
                            <p className="text-[10px] text-accent-red max-w-[200px] mt-0.5">
                              {ord.reject_reason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-2xs text-brand-from font-semibold">{ord.angel_order_id}</td>
                      <td className="text-2xs text-text-muted">
                        {formatDateTime(ord.placed_at)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ord.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleMarkApplied(ord.id)}
                              title="Confirm you have submitted this bid in your broker app (Angel One, Zerodha, etc.)"
                              className="px-2 py-1 text-[10px] font-bold rounded-lg bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 border border-accent-blue/30 transition-all"
                            >
                              Mark Applied
                            </button>
                          )}
                          {['CONFIRMED', 'PENDING', 'SUBMITTED', 'APPLIED'].includes(ord.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(ord.id)}
                                title="Cancel application and release locked ASBA funds back to available balance"
                                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-accent-red/10 text-accent-red hover:bg-accent-red/20 border border-accent-red/30 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAllotmentResult(ord.id, 'NOT_ALLOTTED')}
                                title="Mark as Not Allotted and unblock ASBA funds"
                                className="px-2 py-1 text-[10px] font-medium rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-default transition-all"
                              >
                                Not Allotted
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAllotmentResult(ord.id, 'ALLOTTED')}
                                title="Mark as Allotted and stage for listing-day sell"
                                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/30 transition-all"
                              >
                                Allotted
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord.id)}
                            title="Delete order record permanently"
                            className="p-1 rounded-lg text-text-muted hover:text-accent-red hover:bg-surface-elevated transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
