'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Settings,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'IPO Board', href: '/ipos', icon: TrendingUp },
  { label: 'Fund Manager', href: '/funds', icon: Wallet },
  { label: 'Allotments', href: '/allotments', icon: CheckCircle2 },
  { label: 'Orders', href: '/orders', icon: FileSpreadsheet },
  { label: 'AI Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { isGuest } = useAuth()
  const [accountCount, setAccountCount] = useState<number | null>(null)

  useEffect(() => {
    if (isGuest) {
      setAccountCount(0)
      return
    }
    apiClient
      .getAccounts()
      .then((accs) => {
        setAccountCount(accs.length)
      })
      .catch(() => {
        setAccountCount(0)
      })
  }, [pathname, isGuest])

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
        />
      )}

      {/* Sidebar (232px fixed width) */}
      <aside
        className={`w-[232px] fixed inset-y-0 left-0 z-50 bg-canvas border-r border-line flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-line">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            {/* Amber brand mark */}
            <div className="w-5 h-5 rounded-[4px] bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-accent-ink leading-none">K</span>
            </div>
            <span className="font-medium text-sm text-ink tracking-tight">
              Kapitl
            </span>
          </Link>

          {/* Close button for mobile */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1 rounded text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items (32px high, 16px monochrome stroke icons) */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`h-8 px-2.5 rounded-sm flex items-center gap-2.5 text-xs transition-colors duration-100 ${
                  isActive
                    ? 'bg-surface-selected text-ink font-medium'
                    : 'text-ink-2 hover:text-ink hover:bg-surface-raised font-normal'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? 'text-ink' : 'text-ink-3'
                  }`}
                  strokeWidth={1.5}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer / Real Broker Connection State */}
        <div className="p-3 border-t border-line">
          <div className="p-2.5 rounded-sm bg-surface border border-line flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isGuest ? 'bg-ink-3' : 'bg-positive'
              }`}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-2xs font-medium text-ink truncate">
                {isGuest ? 'Angel One' : 'Angel SmartAPI'}
              </span>
              <span className="text-[11px] text-ink-3 truncate">
                {isGuest
                  ? 'Not connected'
                  : accountCount === null
                  ? 'Connecting...'
                  : `${accountCount} Account${accountCount === 1 ? '' : 's'} linked`}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
