'use client'

import React, { useEffect, useState } from 'react'

interface Item {
  id: string
  text: string
  level: 2 | 3
}

/** "On this page" list that highlights the heading currently in view. */
export function OnThisPage({ items }: { items: Item[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    items.forEach((it) => {
      const el = document.getElementById(it.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [items])

  if (items.length === 0) return null
  return (
    <nav aria-label="On this page" className="text-[13px]">
      <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-3">On this page</p>
      <ul className="space-y-1.5 border-l border-line">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={`-ml-px block border-l py-0.5 ${it.level === 3 ? 'pl-6' : 'pl-3'} ${
                active === it.id ? 'border-[var(--accent)] text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
