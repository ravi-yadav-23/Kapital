'use client'

import React, { ReactNode, useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/lib/auth-context'
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/useWebSocket'
import { apiClient } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

/** Toast-style in-app notification for real-time WS events */
function LiveEventToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-surface border border-line rounded-sm px-3.5 py-2.5 shadow-modal text-xs text-ink animate-fade-in"
      style={{ maxWidth: 320 }}
    >
      <span className="w-2 h-2 rounded-full bg-positive flex-shrink-0" />
      <span className="truncate">{message}</span>
      <button onClick={onDismiss} className="ml-auto text-ink-3 hover:text-ink text-xs">✕</button>
    </div>
  )
}

const WS_EVENT_LABELS: Record<string, string> = {
  ALLOTMENT_RESULT: 'Allotment confirmed',
  ALLOTMENT_DETECTED: 'Allotment confirmed',
  IPOS_SYNCED: 'IPO data refreshed',
  ORDER_PLACED: 'Order placed',
  ORDER_CANCELLED: 'Order cancelled',
  ORDER_FILLED: 'Order filled',
  ORDER_FAILED: 'Order failed',
  SELL_EXECUTED: 'Pre-listing sell executed',
  LISTING_SELLS_DISPATCHED: 'Pre-listing sells dispatched',
  ASBA_LOCKS_SWEPT: 'ASBA fund locks swept',
  HEARTBEAT: '',
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isGuest, isLoading } = useAuth()
  const [toast, setToast] = useState<string | null>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleWsMessage = useCallback((msg: WebSocketMessage) => {
    if (msg.type === 'IPOS_SYNCED') {
      apiClient.clearCache('ipos')
    } else if (
      msg.type === 'ORDER_PLACED' ||
      msg.type === 'ORDER_CANCELLED' ||
      msg.type === 'ORDER_FILLED' ||
      msg.type === 'ORDER_FAILED' ||
      msg.type === 'ASBA_LOCKS_SWEPT'
    ) {
      apiClient.clearCache('orders')
      apiClient.clearCache('funds')
    } else if (
      msg.type === 'ALLOTMENT_RESULT' ||
      msg.type === 'ALLOTMENT_DETECTED' ||
      msg.type === 'SELL_EXECUTED' ||
      msg.type === 'LISTING_SELLS_DISPATCHED'
    ) {
      apiClient.clearCache('allotments')
      apiClient.clearCache('orders')
      apiClient.clearCache('funds')
    }

    const label = WS_EVENT_LABELS[msg.type]
    if (label === undefined) {
      setToast(msg.message || msg.type)
    } else if (label !== '') {
      const detail = msg.message ? ` — ${msg.message}` : ''
      setToast(`${label}${detail}`)
    }
  }, [])

  const { isConnected } = useWebSocket(isAuthenticated && !isGuest ? handleWsMessage : undefined)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-canvas flex flex-col items-center justify-center text-ink-2" suppressHydrationWarning>
        <Loader2 className="w-5 h-5 animate-spin text-ink-3 mb-2" />
        <span className="text-xs font-normal">Loading workspace...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* 232px Sidebar */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area (offset by 232px on desktop) */}
      <div className="flex-1 lg:pl-[232px] flex flex-col min-h-screen bg-canvas w-full">
        {/* 36px Guest Mode Notice Banner */}
        {isGuest && (
          <div className="h-9 bg-surface border-b border-line px-4 flex items-center justify-between text-xs text-ink-2">
            <div className="flex items-center gap-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-3 flex-shrink-0" />
              <span className="truncate">
                Demo workspace. IPO data is live. Accounts, orders and P&L are sample data.
              </span>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="btn-secondary h-6 px-2 text-[11px] flex-shrink-0 ml-3"
            >
              Sign in
            </button>
          </div>
        )}

        {/* 48px Topbar */}
        <Topbar onMenuClick={() => setIsMobileSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 bg-canvas p-4 sm:p-6 w-full animate-fade-in">
          {children}
        </main>
      </div>

      {/* Real-time event toast */}
      {toast && (
        <LiveEventToast message={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Offline dot */}
      {!isConnected && isAuthenticated && !isGuest && (
        <div
          title="Live WebSocket stream disconnected"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 bg-surface border border-line rounded-full px-2 py-0.5 text-[10px] text-ink-3"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-negative" />
          Offline
        </div>
      )}
    </div>
  )
}
