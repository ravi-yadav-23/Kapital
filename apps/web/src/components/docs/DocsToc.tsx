'use client'

import React from 'react'
import { Hash, ExternalLink, MessageSquare, Github, Linkedin, Globe, Sparkles } from 'lucide-react'

interface TocItem {
  id: string
  label: string
}

interface DocsTocProps {
  items: TocItem[]
  activeTocId?: string
  onSelectToc: (id: string) => void
}

export function DocsToc({ items, activeTocId, onSelectToc }: DocsTocProps) {
  return (
    <aside className="hidden xl:block w-64 fixed top-14 bottom-0 right-0 z-30 p-6 overflow-y-auto border-l border-[var(--border-default)]">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-1.5 text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] font-medium mb-3">
            <Hash className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>On this page</span>
          </div>

          <nav className="space-y-1">
            {items.map((item) => {
              const isActive = activeTocId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectToc(item.id)}
                  className={`block w-full text-left text-xs py-1 transition-colors ${
                    isActive
                      ? 'text-[var(--accent)] font-medium translate-x-1'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Creator & Links Quick Card */}
        <div className="p-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] space-y-3">
          <div className="flex items-center gap-1.5 text-2xs font-mono text-[var(--accent)]">
            <Sparkles className="w-3 h-3" />
            <span>AUTHOR LINKS</span>
          </div>

          <div className="space-y-2 text-xs">
            <a
              href="https://www.linkedin.com/in/raviyadav23/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-[var(--ink-2)] hover:text-[#0a66c2] transition-colors group"
            >
              <span className="flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-[#0a66c2]" />
                LinkedIn
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://github.com/ravi-yadav-23"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-[var(--ink-2)] hover:text-purple-400 transition-colors group"
            >
              <span className="flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-purple-400" />
                GitHub
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://ravi-yadav-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-[var(--ink-2)] hover:text-[var(--accent)] transition-colors group"
            >
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                Portfolio
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>

          <div className="pt-2 border-t border-[var(--border-default)]">
            <button
              onClick={() => onSelectToc('contact-and-creator')}
              className="w-full py-1 text-center text-2xs font-mono text-[var(--ink-2)] hover:text-[var(--ink-1)] bg-[var(--bg-elevated)] rounded border border-[var(--border-default)] transition-colors"
            >
              Direct Contact Section ↓
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

