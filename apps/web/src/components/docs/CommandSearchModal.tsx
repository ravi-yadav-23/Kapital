'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  X,
  Compass,
  Sparkles,
  Cpu,
  TrendingUp,
  Terminal,
  User,
  ArrowRight,
  Hash,
  CornerDownLeft,
} from 'lucide-react'
import { DOCS_CHAPTERS } from './docs-data'

interface CommandSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTopic: (topicId: string, sectionId?: string) => void
}

const CHAPTER_ICONS: Record<string, any> = {
  Compass,
  Sparkles,
  Cpu,
  TrendingUp,
  Terminal,
  User,
}

export function CommandSearchModal({
  isOpen,
  onClose,
  onSelectTopic,
}: CommandSearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Flattened searchable items
  const searchResults = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const items: Array<{
      chapterId: string
      sectionId: string
      title: string
      description: string
      badge?: string
      chapterTitle: string
      iconName: string
    }> = []

    DOCS_CHAPTERS.forEach((ch) => {
      ch.sections.forEach((sec) => {
        if (
          !q ||
          sec.title.toLowerCase().includes(q) ||
          sec.description.toLowerCase().includes(q) ||
          sec.badge?.toLowerCase().includes(q) ||
          ch.title.toLowerCase().includes(q)
        ) {
          items.push({
            chapterId: ch.id,
            sectionId: sec.id,
            title: sec.title,
            description: sec.description,
            badge: sec.badge,
            chapterTitle: ch.title,
            iconName: ch.iconName,
          })
        }
      })
    })

    return items
  }, [query])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length))
      } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
        e.preventDefault()
        const item = searchResults[selectedIndex]
        onSelectTopic(item.chapterId, item.sectionId)
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, searchResults, selectedIndex, onSelectTopic, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg shadow-2xl overflow-hidden z-10 animate-scale-up">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/60">
          <Search className="w-4 h-4 text-[var(--ink-3)] mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search documentation, formulas, MILP solver, SmartAPI..."
            className="w-full bg-transparent text-xs sm:text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[var(--border-default)]/40">
          {searchResults.length > 0 ? (
            searchResults.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const Icon = CHAPTER_ICONS[item.iconName] || Hash

              return (
                <div
                  key={`${item.chapterId}-${item.sectionId}`}
                  onClick={() => {
                    onSelectTopic(item.chapterId, item.sectionId)
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-md cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-[var(--bg-elevated)] text-[var(--ink-1)] border-l-2 border-[var(--accent)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--bg-elevated)]/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--ink-3)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--ink-1)] truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--ink-3)]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-[var(--ink-3)] line-clamp-1">
                        {item.description}
                      </p>
                      <div className="text-[10px] font-mono text-[var(--accent)]/80">
                        {item.chapterTitle}
                      </div>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${
                      isSelected ? 'opacity-100 text-[var(--accent)]' : 'opacity-0'
                    }`}
                  />
                </div>
              )
            })
          ) : (
            <div className="py-12 text-center text-xs text-[var(--ink-3)] space-y-1">
              <div>No results found for &quot;{query}&quot;</div>
              <div className="text-2xs text-[var(--ink-3)]">Try searching for &quot;PuLP&quot;, &quot;DRHP&quot;, &quot;Gatekeeper&quot;, or &quot;SmartAPI&quot;</div>
            </div>
          )}
        </div>

        {/* Modal Footer Shortcuts */}
        <div className="px-4 py-2 border-t border-[var(--border-default)] bg-[var(--bg-elevated)]/40 flex items-center justify-between text-2xs font-mono text-[var(--ink-3)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-default)] text-[9px]">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-default)] text-[9px] flex items-center">
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-default)] text-[9px]">ESC</kbd>
              <span>Close</span>
            </span>
          </div>

          <span className="text-[var(--accent)]">Kapitl Search</span>
        </div>
      </div>
    </div>
  )
}

