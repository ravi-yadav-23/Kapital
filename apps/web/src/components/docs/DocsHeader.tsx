'use client'

import React from 'react'
import Link from 'next/link'
import {
  Search,
  Menu,
  X,
  Github,
  Globe,
  Linkedin,
  ArrowRight,
  ExternalLink,
  BookOpen,
  LayoutDashboard,
} from 'lucide-react'

interface DocsHeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  isMobileSidebarOpen: boolean
  onToggleMobileSidebar: () => void
}

export function DocsHeader({
  searchQuery,
  onSearchChange,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
}: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--border-default)] bg-[var(--bg-base)]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Brand & Version Badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-1.5 rounded-md text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded bg-[var(--accent)] text-[var(--bg-base)] font-mono font-medium text-xs flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-hover)] transition-colors">
            K
          </div>
          <span className="font-medium text-sm text-[var(--ink-1)] tracking-tight">
            Kapitl
          </span>
        </Link>

        <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-default)]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
            <BookOpen className="w-3 h-3" />
            DOCS
          </span>
          <span className="hidden sm:inline text-2xs font-mono text-[var(--ink-3)]">
            v2.4 Production
          </span>
        </div>
      </div>

      {/* Center Search Input */}
      <div className="hidden md:flex items-center max-w-sm w-full mx-4">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documentation (MILP, Gatekeepers, API)..."
            className="w-full h-8 pl-8 pr-12 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-default)] text-[10px] font-mono text-[var(--ink-3)] pointer-events-none">
            /
          </kbd>
        </div>
      </div>

      {/* Right Shortcuts & Socials */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* Creator Verified Links Dropdown / Pills */}
        <div className="hidden xl:flex items-center gap-2 pr-3 border-r border-[var(--border-default)]">
          <a
            href="https://www.linkedin.com/in/raviyadav23/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-[var(--ink-2)] hover:text-[#0a66c2] hover:bg-[var(--bg-elevated)] transition-colors"
            title="LinkedIn: Ravi Yadav"
          >
            <Linkedin className="w-3 h-3" />
            <span>LinkedIn</span>
          </a>
          <a
            href="https://github.com/ravi-yadav-23"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-[var(--ink-2)] hover:text-purple-400 hover:bg-[var(--bg-elevated)] transition-colors"
            title="GitHub: @ravi-yadav-23"
          >
            <Github className="w-3 h-3" />
            <span>GitHub</span>
          </a>
          <a
            href="https://ravi-yadav-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-[var(--ink-2)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Portfolio: Ravi Yadav"
          >
            <Globe className="w-3 h-3" />
            <span>Portfolio</span>
          </a>
        </div>

        {/* GitHub Repo */}
        <a
          href="https://github.com/ravi-yadav-23/Kapital"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors py-1 px-2 rounded hover:bg-[var(--bg-elevated)]"
        >
          <Github className="w-3.5 h-3.5" />
          <span>Star Repo</span>
        </a>

        {/* Go to Platform */}
        <Link
          href="/dashboard"
          className="btn btn-primary btn-sm gap-1.5"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Launch Platform</span>
          <span className="sm:hidden">App</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  )
}
