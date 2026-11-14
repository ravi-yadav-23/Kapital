import React from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Block, slugifyHeading } from '@/lib/docs-content'

/** Renders a documentation page's content blocks. Server-compatible (no state). */
export function DocBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[15px] leading-7 text-ink-2">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return (
              <h2 key={i} id={slugifyHeading(b.text)} className="scroll-mt-24 pt-4 text-[20px] font-semibold tracking-tight text-ink">
                {b.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} id={slugifyHeading(b.text)} className="scroll-mt-24 pt-2 text-[16px] font-semibold text-ink">
                {b.text}
              </h3>
            )
          case 'p':
            return <p key={i}>{b.text}</p>
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-2 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-2 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ol>
            )
          case 'callout': {
            const warn = b.tone === 'warn'
            const Icon = warn ? AlertTriangle : Info
            return (
              <aside
                key={i}
                className={`flex gap-3 rounded-sm border p-4 ${
                  warn ? 'border-amber-500/40 bg-amber-500/5' : 'border-line bg-surface-raised'
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${warn ? 'text-amber-400' : 'text-ink-3'}`} aria-hidden />
                <div className="text-[14px] leading-6">
                  <p className="font-medium text-ink">{b.title}</p>
                  <p className="mt-1">{b.text}</p>
                </div>
              </aside>
            )
          }
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-sm border border-line">
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
                          <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'font-medium text-ink' : ''}`}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-sm border border-line bg-surface-raised p-4 text-[13px] leading-6 text-ink">
                <code>{b.text}</code>
              </pre>
            )
        }
      })}
    </div>
  )
}
