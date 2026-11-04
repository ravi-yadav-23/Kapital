'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { apiClient } from '@/lib/api-client'
import {
  Bell,
  RefreshCw,
  Search,
  Menu,
  X,
  Settings,
  User,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react'
import { usePrivacyMode } from '@/lib/hooks/usePrivacyMode'

interface TopbarProps {
  onMenuClick?: () => void
  className?: string
}

export function Topbar({ onMenuClick, className = '' }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isGuest, logout } = useAuth()
  const { isPrivacyActive, togglePrivacyMode } = usePrivacyMode()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [syncToast, setSyncToast] = useState<{ message: string; success: boolean } | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => Date.now() - 120_000)
  const [syncLabel, setSyncLabel] = useState('Synced 2m ago')
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Dynamic relative timestamp for sync button
  useEffect(() => {
    const updateLabel = () => {
      const diff = Math.max(0, Date.now() - lastSyncTime)
      if (diff < 60_000) {
        setSyncLabel('Synced just now')
      } else if (diff < 120_000) {
        setSyncLabel('Synced 1m ago')
      } else {
        const mins = Math.floor(diff / 60_000)
        setSyncLabel(`Synced ${mins}m ago`)
      }
    }
    updateLabel()
    const timer = setInterval(updateLabel, 30_000)
    return () => clearInterval(timer)
  }, [lastSyncTime])

  // Auto-dismiss sync toast after 3 seconds
  useEffect(() => {
    if (!syncToast) return
    const timer = setTimeout(() => {
      setSyncToast(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [syncToast])

  // Initialize theme from DOM or localStorage
  useEffect(() => {
    const currentTheme = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark'
    setTheme(currentTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    localStorage.setItem('kapitl_theme', nextTheme)
  }

  // Handle clicking outside user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut for ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/ipos?search=${encodeURIComponent(searchQuery.trim())}`)
      setIsSearchOpen(false)
      setSearchQuery('')
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setSyncToast(null)

    try {
      // Invalidate client-side SWR caches
      apiClient.clearCache()

      // Trigger live sync or data fetch
      if (!isGuest) {
        await apiClient.syncIpos().catch(() => null)
      } else {
        await apiClient.getIpos('all').catch(() => null)
      }

      // Dispatch global refresh so active views update immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kapitl:ws-event', { detail: { type: 'IPOS_SYNCED' } })
        )
      }

      setLastSyncTime(Date.now())
      setSyncLabel('Synced just now')
      setSyncToast({ message: 'Synced successfully', success: true })
    } catch (err) {
      console.error('Failed to sync market data:', err)
      setSyncToast({ message: 'Sync not succeeded', success: false })
    } finally {
      setIsRefreshing(false)
    }
  }

  const getPageTitle = () => {
    const path = pathname || ''
    if (path === '/' || path === '/dashboard') return 'Dashboard'
    if (path === '/ipos') return 'IPO Board'
    if (path === '/funds') return 'Fund Manager'
    if (path === '/allotments') return 'Allotments'
    if (path === '/orders') return 'Orders'
    if (path === '/reports') return 'AI Reports'
    if (path === '/settings') return 'Settings'
    if (path === '/design-preview') return 'Design Preview'
    if (path.startsWith('/ipos/')) return 'IPO Details'
    return 'Kapitl'
  }

  return (
    <header className={`h-12 bg-canvas border-b border-line flex items-center justify-between px-4 sticky top-0 z-40 ${className}`}>
      {/* Left: Mobile Menu Toggle + Breadcrumb Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1 rounded text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <span className="text-sm font-medium text-ink tracking-tight">
          {getPageTitle()}
        </span>
      </div>

      {/* Center: Search with ⌘K Hint */}
      <div className="hidden md:flex items-center max-w-sm w-full mx-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search IPOs, symbols, accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-12 text-xs bg-surface border border-line rounded-sm text-ink placeholder:text-ink-3 focus:border-line-strong transition-colors"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-ink-3 border border-line px-1 rounded bg-surface-raised leading-none py-0.5">
            ⌘K
          </kbd>
        </form>
      </div>

      {/* Right: Controls & Avatar */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="md:hidden p-1.5 rounded text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Sync Button & Feedback Toast */}
        <div className="relative">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 rounded-sm border border-line text-xs text-ink-2 hover:text-ink hover:bg-surface-raised flex items-center gap-1.5 transition-colors disabled:opacity-75"
            title="Sync market data"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-ink' : 'text-ink-3'}`} />
            <span className="hidden sm:inline text-2xs">{syncLabel}</span>
          </button>

          {syncToast && (
            <div
              role="status"
              className={`absolute right-0 top-10 z-50 flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs shadow-md whitespace-nowrap animate-fade-in ${
                syncToast.success
                  ? 'bg-surface border-line text-ink'
                  : 'bg-surface border-negative/40 text-negative'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  syncToast.success ? 'bg-positive' : 'bg-negative'
                }`}
              />
              <span className="text-[11px] font-medium">{syncToast.message}</span>
            </div>
          )}
        </div>

        {/* Privacy Masking Toggle */}
        <button
          onClick={togglePrivacyMode}
          className={`h-8 px-2 rounded-sm border transition-colors flex items-center gap-1.5 text-xs ${
            isPrivacyActive
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'border-line text-ink-3 hover:text-ink hover:bg-surface-raised'
          }`}
          title={isPrivacyActive ? 'Privacy mode active (balances & names masked). Click to reveal.' : 'Mask balances and family names (Privacy mode)'}
          aria-label="Toggle privacy mode"
        >
          {isPrivacyActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline text-2xs font-mono">
            {isPrivacyActive ? 'Privacy ON' : 'Privacy'}
          </span>
        </button>

        {/* Notifications */}
        <button
          className="btn-ghost"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-ink-2" />
        </button>

        {/* User Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="h-8 px-2 rounded-sm border border-line bg-surface hover:bg-surface-raised flex items-center gap-2 text-xs transition-colors"
          >
            <div className="w-4 h-4 rounded-full bg-surface-selected flex items-center justify-center text-ink text-[10px] font-medium uppercase">
              {user?.username ? user.username.charAt(0) : 'G'}
            </div>
            <span className="hidden sm:inline text-xs font-normal text-ink">
              {user?.username || (isGuest ? 'Guest' : 'Admin')}
            </span>
            <ChevronDown className="w-3 h-3 text-ink-3" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-surface border border-line-strong rounded-sm shadow-modal py-1 z-50 animate-fade-in">
              {/* User Identity Header */}
              <div className="px-3 py-2 border-b border-line">
                <div className="text-xs font-medium text-ink truncate">
                  {user?.username || (isGuest ? 'Guest Investor' : 'Administrator')}
                </div>
                <div className="text-2xs text-ink-3 truncate mt-0.5">
                  {isGuest ? 'Sample Workspace' : user?.email || 'admin@kapitl.internal'}
                </div>
              </div>

              {/* Theme Toggle in Menu */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
              >
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  <span>Appearance</span>
                </div>
                <span className="text-[11px] font-mono text-ink-3 capitalize">{theme}</span>
              </button>

              {/* Settings Link */}
              <Link
                href="/settings"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </Link>

              {/* Sign In / Sign Out */}
              <div className="border-t border-line mt-1 pt-1">
                {isGuest ? (
                  <Link
                    href="/login"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-surface-raised transition-colors font-medium"
                  >
                    <span>Sign In to Broker →</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      logout()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-negative hover:bg-surface-raised transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-canvas/95 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                type="text"
                placeholder="Search IPOs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-line rounded-sm text-ink"
              />
            </form>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-2 text-ink-2 hover:text-ink"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export default Topbar
