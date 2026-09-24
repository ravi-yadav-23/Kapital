'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  RefreshCw,
  Search,
  Sparkles,
  Clock,
  Menu,
  X,
  Settings,
  User,
  LogOut,
  HelpCircle,
  Shield,
  Zap,
  TrendingUp,
  Wallet,
  FileText,
  CheckCircle2,
  LayoutDashboard,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react'

// Simple cn function without external dependencies
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

interface TopbarProps {
  onMenuClick?: () => void
  className?: string
}

// ── Sub-component: Search Bar ─────────────────────────────────────

function SearchBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/ipos?search=${encodeURIComponent(query)}`)
      setIsOpen(false)
      setQuery('')
    }
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const recentSearches: string[] = []

  return (
    <>
      {/* Search Toggle Button (Mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Search Overlay (Mobile) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-surface-background/95 backdrop-blur-sm p-4">
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search IPOs, symbols, companies..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface-elevated border-border-subtle focus:border-brand-from rounded-xl"
                />
              </div>
            </form>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Recent Searches */}
          <div className="mt-6">
            <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Recent Searches
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term)
                    router.push(`/ipos?search=${encodeURIComponent(term)}`)
                    setIsOpen(false)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:border-brand-from transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Search */}
      <form onSubmit={handleSearch} className="hidden lg:block flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search IPOs, symbols, DRHP filings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-elevated/80 border-border-subtle focus:border-brand-from rounded-lg transition-all focus:ring-1 focus:ring-brand-from/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </>
  )
}

// ── Sub-component: Quick Actions ─────────────────────────────────

function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const actions = [
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'View Open IPOs', href: '/ipos?status=open' },
    { icon: <Wallet className="w-3.5 h-3.5" />, label: 'Check Fund Balance', href: '/funds' },
    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'View Allotments', href: '/allotments' },
    { icon: <FileText className="w-3.5 h-3.5" />, label: 'AI Reports', href: '/reports' },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
        title="Quick Actions"
      >
        <Zap className="w-4 h-4 text-accent-amber" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-card border border-border-strong rounded-xl shadow-2xl py-1.5 z-50 animate-slide-down">
          <div className="px-3 py-2 border-b border-border-subtle">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Quick Actions
            </span>
          </div>
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <span className="text-brand-from">{action.icon}</span>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: Notifications ─────────────────────────────────

interface NotificationItem {
  id: number | string
  title: string
  description: string
  time: string
  type: 'success' | 'warning' | 'info'
  read: boolean
}

function Notifications() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-accent-green/10 text-accent-green'
      case 'warning':
        return 'bg-accent-amber/10 text-accent-amber'
      case 'info':
        return 'bg-accent-blue/10 text-accent-blue'
      default:
        return 'bg-surface-elevated text-text-muted'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-amber text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-card border border-border-strong rounded-xl shadow-2xl z-50 max-h-[400px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-2xs text-brand-from hover:text-brand-from/80 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-elevated transition-colors border-b border-border-subtle last:border-0 cursor-pointer ${
                    !notif.read ? 'bg-brand-from/5' : ''
                  }`}
                  onClick={() => router.push('/notifications')}
                >
                  <div className={`w-8 h-8 rounded-full ${getTypeStyles(notif.type)} flex items-center justify-center flex-shrink-0`}>
                    {notif.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {notif.type === 'info' && <Bell className="w-3.5 h-3.5" />}
                    {notif.type === 'warning' && <Sparkles className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-text-primary">
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-from flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-2xs text-text-muted mt-0.5">{notif.description}</p>
                    <span className="text-[10px] text-text-muted/60 mt-1 block">{notif.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-text-muted flex flex-col items-center justify-center gap-2">
                <Bell className="w-6 h-6 text-text-muted/40" />
                <p className="text-xs font-medium text-text-secondary">No notifications yet</p>
                <p className="text-2xs text-text-muted">You will be alerted when IPO mandates, AI scores, or allotments occur.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border-subtle">
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/notifications')
                }}
                className="w-full text-center text-2xs text-brand-from hover:text-brand-from/80 transition-colors"
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: Theme Toggle ──────────────────────────────────

function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
      title="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

// ── Sub-component: User Menu ─────────────────────────────────────

import { useAuth } from '@/lib/auth-context'

function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, isGuest, logout } = useAuth()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const menuItems = [
    { icon: <LayoutDashboard className="w-3.5 h-3.5" />, label: 'Dashboard', href: '/dashboard' },
    { icon: <Wallet className="w-3.5 h-3.5" />, label: 'Fund Manager', href: '/funds' },
    { icon: <Settings className="w-3.5 h-3.5" />, label: 'Settings', href: '/settings' },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
      >
        <div className="w-7 h-7 rounded-full bg-brand-from/15 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-brand-from" />
        </div>
        <span className="hidden xl:inline text-xs font-medium text-text-primary">
          {user?.username || (isGuest ? 'Guest' : 'Admin')}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface-card border border-border-strong rounded-xl shadow-2xl py-1.5 z-50 animate-slide-down">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary truncate">
                {user?.username || 'Kapitl User'}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isGuest
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {isGuest ? 'GUEST' : 'ADMIN'}
              </span>
            </div>
            <div className="text-2xs text-text-muted truncate mt-0.5">
              {user?.email || (isGuest ? 'guest-preview@kapitl.local' : 'Authorized Administrator')}
            </div>
          </div>

          {/* Menu Items */}
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          {/* Logout Button */}
          <div className="border-t border-border-subtle mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false)
                logout()
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



// ── Main Component ─────────────────────────────────────────────────

export function Topbar({ onMenuClick, className }: TopbarProps) {
  const [time, setTime] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const getPageTitle = () => {
    const path = pathname || ''
    if (path === '/') return 'Dashboard'
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/ipos') return 'IPO Discovery'
    if (path === '/funds') return 'Fund Manager'
    if (path === '/allotments') return 'Allotment Tracker'
    if (path === '/orders') return 'Order History'
    if (path === '/reports') return 'AI Reports'
    if (path === '/settings') return 'Settings'
    if (path.startsWith('/ipos/')) return 'IPO Details'
    return ''
  }

  return (
    <header className={cn('topbar', className)}>
      {/* Left: Menu Toggle + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-text-primary">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Center: Search */}
      <SearchBar />

      {/* Right: Controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Live IST clock */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated/60 border border-border-subtle">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <Clock className="w-3 h-3 text-text-muted" />
          <span className="text-2xs font-mono text-text-secondary">{time || '--:--:--'}</span>
        </div>

        {/* AI Agent Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-to/10 border border-brand-to/25">
          <Sparkles className="w-3 h-3 text-brand-from" />
          <span className="text-2xs font-medium text-brand-to">AI Ready</span>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Sync Button */}
        <button
          onClick={handleRefresh}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
          title="Refresh live data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-from' : ''}`} />
          <span className="text-2xs font-medium">Sync</span>
        </button>

        <button
          onClick={handleRefresh}
          className="sm:hidden p-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors border border-border-subtle"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-from' : ''}`} />
        </button>

        {/* Notifications */}
        <Notifications />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  )
}

export default Topbar