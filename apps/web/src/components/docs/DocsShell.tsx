'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { findPage, pagesByGroup, searchDocs } from '@/lib/docs-content'

/** Docs frame: top bar with search, grouped navigation (drawer on phones) and the page content. */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchDocs(query), [query])
  const groups = useMemo(() => pagesByGroup(), [])
  const currentGroup = findPage(pathname.split('/')[2] ?? '')?.group
  const searchRef = useRef<HTMLInputElement>(null)

  // Ctrl+K / Cmd+K focuses search, Escape clears it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nav = (
    <nav aria-label="Documentation" className="space-y-6">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wide text-ink-3">{g.group}</p>
          <ul className="space-y-0.5">
            {g.pages.map((p) => {
              const href = `/docs/${p.slug}`
              const active = pathname === href
              return (
                <li key={p.slug}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-sm px-2 py-1.5 text-[14px] ${
                      active ? 'bg-surface-raised font-medium text-ink' : 'text-ink-2 hover:bg-surface-raised hover:text-ink'
                    }`}
                  >
                    {p.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4">
          <button
            type="button"
            className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-raised lg:hidden"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/docs" className="text-[15px] font-semibold tracking-tight">
            Kapitl <span className="font-normal text-ink-3">Docs</span>
          </Link>

          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur() } }}
              placeholder="Search the docs"
              aria-label="Search the docs"
              className="w-full rounded-sm border border-line bg-surface-raised py-2 pl-8 pr-14 text-[14px] text-ink placeholder:text-ink-3 focus:border-[var(--accent)] focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2 top-2 hidden rounded-[4px] border border-line px-1.5 text-[11px] leading-5 text-ink-3 sm:block">Ctrl K</kbd>
            {query.trim() && (
              <div className="absolute left-0 right-0 top-11 max-h-80 overflow-y-auto rounded-sm border border-line bg-surface p-1 shadow-lg">
                {results.length === 0 ? (
                  <p className="px-3 py-2 text-[13px] text-ink-3">No pages match &ldquo;{query}&rdquo;.</p>
                ) : (
                  results.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/docs/${p.slug}`}
                      onClick={() => setQuery('')}
                      className="block rounded-sm px-3 py-2 hover:bg-surface-raised"
                    >
                      <span className="block text-[11px] uppercase tracking-wide text-ink-3">{p.group}</span>
                      <span className="block text-[14px] font-medium text-ink">{p.title}</span>
                      <span className="block text-[12px] text-ink-3">{p.description}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <Link href="/dashboard" className="hidden whitespace-nowrap text-[14px] text-ink-2 hover:text-ink sm:block">
            Open app
          </Link>
        </div>
        <nav aria-label="Documentation sections" className="mx-auto hidden max-w-[1280px] gap-6 overflow-x-auto px-4 lg:flex">
          {groups.map((g) => {
            const active = g.group === currentGroup
            return (
              <Link
                key={g.group}
                href={`/docs/${g.pages[0].slug}`}
                className={`-mb-px whitespace-nowrap border-b-2 py-2.5 text-[13px] ${
                  active ? 'border-[var(--accent)] font-medium text-ink' : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {g.group}
              </Link>
            )
          })}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1280px] gap-10 px-4">
        <aside className="sticky top-[100px] hidden h-[calc(100vh-100px)] w-60 shrink-0 overflow-y-auto py-8 lg:block">{nav}</aside>
        {open && (
          <div className="fixed inset-x-0 bottom-0 top-14 z-30 overflow-y-auto bg-surface p-4 lg:hidden">{nav}</div>
        )}
        <div className="min-w-0 flex-1 py-8">{children}</div>
      </div>
    </div>
  )
}
