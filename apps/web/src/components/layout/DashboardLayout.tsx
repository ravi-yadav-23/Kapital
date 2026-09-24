'use client'

import React, { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/lib/auth-context'
import { Eye, ShieldAlert, Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isGuest, isLoading } = useAuth()

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
          <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Guest Preview Mode:</strong> You are exploring Kapitl with a blank demo profile. Live order placement and Angel One account credentials are locked.
              </span>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-200 underline ml-2 cursor-pointer flex-shrink-0"
            >
              Sign in as Admin
            </button>
          </div>
        )}

        <Topbar />
        <main className="page-content animate-fade-in flex-1">{children}</main>
      </div>
    </div>
  )
}
