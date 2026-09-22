import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Settings,
  Sparkles,
  ShieldCheck,
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

export function Sidebar() {
  const pathname = usePathname()
  const [accountCount, setAccountCount] = useState<number | null>(null)

  useEffect(() => {
    apiClient.getAccounts().then((accs) => {
      setAccountCount(accs.length)
    }).catch(() => {
      setAccountCount(0)
    })
  }, [pathname])

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="h-[60px] flex items-center px-5 border-b border-border-subtle gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-from to-brand-to flex items-center justify-center shadow-md shadow-brand-from/25">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight gradient-text">
            KAPITL
          </span>
          <span className="text-[10px] tracking-wider uppercase text-text-muted font-mono">
            IPO Auto-Invest
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="section-label">Main Menu</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 nav-icon flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer / Angel One Status Badge */}
      <div className="p-3 border-t border-border-subtle">
        <div className="card p-3 bg-surface-elevated/70 border-border-subtle rounded-xl flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-2xs font-semibold text-text-primary truncate">
                Angel SmartAPI
              </span>
              <ShieldCheck className="w-3 h-3 text-accent-green" />
            </div>
            <span className="text-[10px] text-text-muted truncate">
              {accountCount === null
                ? 'Connecting...'
                : accountCount === 0
                ? 'Ready to Link Demats'
                : `${accountCount} Account${accountCount > 1 ? 's' : ''} Synced`}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

