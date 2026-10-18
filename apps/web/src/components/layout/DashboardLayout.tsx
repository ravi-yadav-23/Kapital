'use client'

import React, { ReactNode, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/lib/auth-context'
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/useWebSocket'
import { Eye, Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

/** Toast-style in-app notification for real-time WS events. */
function LiveEventToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl text-sm text-slate-100 animate-fade-in"
      style={{ maxWidth: 340 }}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
    </div>
  )
}

const WS_EVENT_LABELS: Record<string, string> = {
  ALLOTMENT_DETECTED: '🎯 Allotment confirmed!',
  IPOS_SYNCED: '🔄 IPO data refreshed',
  ORDER_PLACED: '📝 Order placed',
  ORDER_FILLED: '✅ Order filled',
  ORDER_FAILED: '❌ Order failed',
  SELL_EXECUTED: '💰 Pre-listing sell executed',
  HEARTBEAT: '',
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isGuest, isLoading } = useAuth()

  const [toast, setToast] = React.useState<string | null>(null)

  const handleWsMessage = useCallback((msg: WebSocketMessage) => {
    // Suppress heartbeats; surface all other events
    const label = WS_EVENT_LABELS[msg.type]
    if (label === undefined) {
      // Unknown event — show raw type
      setToast(msg.message || msg.type)
    } else if (label !== '') {
      const detail = msg.message ? ` ${msg.message}` : ''
      setToast(`${label}${detail}`)
    }
    // If label === '' (heartbeat) — silently ignore
  }, [])

  const { isConnected } = useWebSocket(isAuthenticated && !isGuest ? handleWsMessage : undefined)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#080d1a] flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <span className="text-xs font-medium tracking-wide">Loading Kapitl...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-content flex flex-col">
        {/* Guest Mode Notice Banner */}
        {isGuest && (
          <div className="bg-[#1a1612] border-b border-[#2d2520] px-4 py-2.5 flex items-center justify-between text-xs text-[#fafaf9]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse flex-shrink-0" />
              <span>
                <strong className="text-[#f59e0b]">Guest Portfolio Preview:</strong> Exploring live market data and seeded family demo allocations. Order placement and broker credentials are locked.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/settings')}
                className="text-xs font-semibold text-[#f59e0b] hover:text-[#d97706] hover:underline cursor-pointer flex-shrink-0"
              >
                Link your Angel One accounts →
              </button>
              <button
                onClick={() => router.push('/login')}
                className="text-[11px] text-[#a8a29e] hover:text-[#fafaf9] underline cursor-pointer flex-shrink-0"
              >
                Admin Sign In
              </button>
            </div>
          </div>
        )}

        <Topbar />
        <main className="page-content animate-fade-in flex-1">{children}</main>
      </div>

      {/* Real-time event toast — only shown when a meaningful WS event arrives */}
      {toast && (
        <LiveEventToast message={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Subtle WS connection indicator (dot in bottom-left, only when disconnected) */}
      {!isConnected && isAuthenticated && !isGuest && (
        <div
          title="WebSocket disconnected — live updates paused"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 bg-slate-900/80 border border-slate-700 rounded-full px-2.5 py-1 text-[10px] text-slate-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Offline
        </div>
      )}
    </div>
  )
}
