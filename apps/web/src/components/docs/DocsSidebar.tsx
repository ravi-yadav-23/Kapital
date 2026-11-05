'use client'

import React from 'react'
import {
  Compass,
  Sparkles,
  Cpu,
  TrendingUp,
  Terminal,
  User,
  ChevronRight,
  ExternalLink,
  Linkedin,
  Github,
  Globe,
  Mail,
} from 'lucide-react'
import { DOCS_CHAPTERS, Chapter, DocSection } from './docs-data'

interface DocsSidebarProps {
  activeSection: string
  activeChapterId?: string
  onSelectSection: (id: string, chapterId?: string) => void
  onSelectChapter?: (id: string) => void
  searchQuery: string
  isOpen: boolean
  onClose: () => void
}

const CHAPTER_ICONS: Record<string, any> = {
  Compass,
  Sparkles,
  Cpu,
  TrendingUp,
  Terminal,
  User,
}

export function DocsSidebar({
  activeSection,
  activeChapterId,
  onSelectSection,
  onSelectChapter,
  searchQuery,
  isOpen,
  onClose,
}: DocsSidebarProps) {
  const query = searchQuery.trim().toLowerCase()

  // Filter chapters based on search query
  const filteredChapters = DOCS_CHAPTERS.map((ch) => {
    if (!query) return ch
    const matchingSections = ch.sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(query) ||
        sec.description.toLowerCase().includes(query) ||
        sec.badge?.toLowerCase().includes(query)
    )
    return {
      ...ch,
      sections: matchingSections,
    }
  }).filter((ch) => ch.sections.length > 0)

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-14 bottom-0 left-0 z-40 w-72 bg-[var(--bg-base)] border-r border-[var(--border-default)] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation Section List */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {filteredChapters.map((chapter) => {
            const Icon = CHAPTER_ICONS[chapter.iconName] || Compass

            return (
              <div key={chapter.id} className="space-y-1">
                {/* Chapter Title */}
                <button
                  type="button"
                  onClick={() => onSelectChapter?.(chapter.id)}
                  className={`w-full text-left flex items-center justify-between px-2 py-1 text-2xs uppercase font-mono tracking-wider transition-colors ${
                    activeChapterId === chapter.id
                      ? 'text-[var(--accent)] font-bold'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{chapter.title}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-[var(--ink-3)]" />
                </button>

                {/* Section Links */}
                <div className="space-y-0.5 pt-1">
                  {chapter.sections.map((section) => {
                    const isActive = activeSection === section.id

                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          onSelectSection(section.id)
                          onClose()
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between group transition-colors ${
                          isActive
                            ? 'bg-[var(--bg-elevated)] text-[var(--ink-1)] font-medium border-l-2 border-[var(--accent)]'
                            : 'text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-elevated)]/60'
                        }`}
                      >
                        <span className="truncate pr-2">{section.title}</span>
                        {section.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              isActive
                                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                                : 'bg-[var(--bg-subtle)] text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'
                            }`}
                          >
                            {section.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filteredChapters.length === 0 && (
            <div className="text-center py-8 text-xs text-[var(--ink-3)]">
              No documentation pages match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Bottom Author Profile Summary */}
        <div className="p-3.5 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--bg-base)] flex items-center justify-center font-bold text-xs font-mono">
                RY
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink-1)]">Ravi Yadav</span>
                <span className="text-[10px] text-[var(--ink-3)]">Author & Architect</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[var(--ink-3)]">
              <a
                href="https://www.linkedin.com/in/raviyadav23/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:text-[#0a66c2] hover:bg-[var(--bg-elevated)] transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://github.com/ravi-yadav-23"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:text-purple-400 hover:bg-[var(--bg-elevated)] transition-colors"
                title="GitHub"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://ravi-yadav-portfolio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors"
                title="Portfolio"
              >
                <Globe className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

