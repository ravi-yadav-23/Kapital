import React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, ChevronDown, Info, Lightbulb, Link2 } from 'lucide-react'
import { Block, slugifyHeading } from '@/lib/docs-content'
import { DocDiagram } from './DocDiagrams'
import { CopyButton } from './CopyButton'

/** Renders `backtick` spans as inline code; everything else is plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') && p.length > 2 ? (
          <code key={i} className="rounded-[4px] border border-line bg-surface-raised px-1 py-px font-mono text-[0.88em] text-ink">
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  )
}

function Heading({ level, text }: { level: 2 | 3; text: string }) {
  const id = slugifyHeading(text)
  const Tag = level === 2 ? 'h2' : 'h3'
  return (
    <Tag
      id={id}
      className={`group scroll-mt-28 text-ink ${level === 2 ? 'border-t border-line pt-8 text-[22px] font-semibold tracking-tight first:border-t-0 first:pt-0' : 'pt-2 text-[17px] font-semibold'}`}
    >
      <a href={`#${id}`} className="inline-flex items-center gap-2">
        {text}
        <Link2 className="h-4 w-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </a>
    </Tag>
  )
}

const CALLOUT = {
  note: { Icon: Info, color: 'var(--ink-3)', border: 'var(--line-strong)', bg: 'var(--bg-surface)' },
  tip: { Icon: Lightbulb, color: 'var(--positive)', border: 'color-mix(in srgb, var(--positive) 45%, transparent)', bg: 'color-mix(in srgb, var(--positive) 6%, transparent)' },
  warn: { Icon: AlertTriangle, color: '#d97706', border: 'color-mix(in srgb, #f59e0b 45%, transparent)', bg: 'color-mix(in srgb, #f59e0b 6%, transparent)' },
} as const

/** Renders a documentation page's content blocks. Server-compatible (no state). */
export function DocBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[15px] leading-7 text-ink-2">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return <Heading key={i} level={2} text={b.text} />
          case 'h3':
            return <Heading key={i} level={3} text={b.text} />
          case 'p':
            return <p key={i}><Inline text={b.text} /></p>
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-2 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-2 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
              </ol>
            )
          case 'callout': {
            const c = CALLOUT[b.tone]
            return (
              <aside key={i} className="flex gap-3 rounded-md border p-4" style={{ borderColor: c.border, background: c.bg }}>
                <c.Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.color }} aria-hidden />
                <div className="text-[14px] leading-6">
                  <p className="font-medium text-ink">{b.title}</p>
                  <p className="mt-1"><Inline text={b.text} /></p>
                </div>
              </aside>
            )
          }
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
                  <thead className="bg-surface-raised text-ink-3">
                    <tr>
                      {b.head.map((h) => (
                        <th key={h} className="px-3 py-2 text-[12px] font-medium uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-line align-top">
                        {r.map((c, ci) => (
                          <td key={ci} className={`px-3 py-2 leading-6 ${ci === 0 ? 'font-medium text-ink' : ''}`}><Inline text={c} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'code':
            return (
              <div key={i} className="overflow-hidden rounded-md border border-line bg-surface-raised">
                <div className="flex items-center justify-between border-b border-line px-4 py-1.5 text-[12px] text-ink-3">
                  <span>{b.title ?? b.lang}</span>
                  <CopyButton text={b.text} />
                </div>
                <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-ink">
                  <code className="font-mono">{b.text}</code>
                </pre>
              </div>
            )
          case 'diagram':
            return <DocDiagram key={i} name={b.name} caption={b.caption} />
          case 'steps':
            return (
              <ol key={i} className="relative space-y-5 border-l border-line pl-7">
                {b.items.map((s, j) => (
                  <li key={j} className="relative">
                    <span
                      className="absolute -left-[41px] flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface text-[12px] font-semibold text-ink"
                      aria-hidden
                    >
                      {j + 1}
                    </span>
                    <p className="text-[15px] font-medium leading-7 text-ink">{s.title}</p>
                    <p className="text-[14px] leading-6"><Inline text={s.text} /></p>
                  </li>
                ))}
              </ol>
            )
          case 'cards':
            return (
              <div key={i} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {b.items.map((c) => {
                  const inner = (
                    <>
                      <span className="block text-[14px] font-medium text-ink">{c.title}</span>
                      <span className="mt-1 block text-[13px] leading-5 text-ink-3">{c.text}</span>
                      {c.href && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--accent-text,var(--accent))]">
                          Learn more <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      )}
                    </>
                  )
                  return c.href ? (
                    <Link key={c.title} href={c.href} className="group rounded-md border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong">
                      {inner}
                    </Link>
                  ) : (
                    <div key={c.title} className="rounded-md border border-line bg-surface-raised p-4">{inner}</div>
                  )
                })}
              </div>
            )
          case 'defs':
            return (
              <dl key={i} className="divide-y divide-line rounded-md border border-line">
                {b.items.map((d) => (
                  <div key={d.term} id={slugifyHeading(d.term)} className="grid scroll-mt-28 gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                    <dt className="text-[14px] font-medium text-ink">{d.term}</dt>
                    <dd className="text-[14px] leading-6"><Inline text={d.text} /></dd>
                  </div>
                ))}
              </dl>
            )
          case 'faq':
            return (
              <div key={i} className="divide-y divide-line rounded-md border border-line">
                {b.items.map((f) => (
                  <details key={f.q} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium text-ink">
                      {f.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-2 text-[14px] leading-6"><Inline text={f.a} /></p>
                  </details>
                ))}
              </div>
            )
        }
      })}
    </div>
  )
}
