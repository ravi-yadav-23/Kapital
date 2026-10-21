'use client'
 
import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react'

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Kapitl Global Error Boundary caught exception]:', error)
  }, [error])

  return (
    <div className="min-h-screen w-full bg-[#0c0a09] text-[#fafaf9] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#18181b]/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Unexpected Session Interruption
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Kapitl encountered a temporary client-side state discrepancy. Your credentials and staged orders remain secure.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-left font-mono text-xs text-zinc-400 overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-xs tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs tracking-wide border border-zinc-700 transition-all active:scale-98"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>

        <p className="text-2xs text-zinc-500 font-mono">
          Session ID: {error?.digest || 'SEC-ERR-CLIENT'}
        </p>
      </div>
    </div>
  )
}
