import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DOC_PAGES, pagesByGroup } from '@/lib/docs-content'

const START = ['overview', 'listing-gain-score', 'nightly-run']

export default function DocsIndexPage() {
  const featured = START.map((s) => DOC_PAGES.find((p) => p.slug === s)).filter(Boolean)
  return (
    <main className="max-w-3xl">
      <h1 className="text-[32px] font-semibold tracking-tight text-ink">Kapitl documentation</h1>
      <p className="mt-3 text-[16px] leading-7 text-ink-2">
        Kapitl helps Indian retail investors decide which IPOs to apply to for a listing-day gain and how to split capital
        across family demat accounts. These pages explain how the score works, where the data comes from and what to keep
        in mind.
      </p>

      <h2 className="mt-10 text-[13px] font-medium uppercase tracking-wide text-ink-3">Start with</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {featured.map((p) => (
          <Link
            key={p!.slug}
            href={`/docs/${p!.slug}`}
            className="group rounded-sm border border-line bg-surface-raised p-4 hover:border-line-strong"
          >
            <span className="block text-[15px] font-medium text-ink">{p!.title}</span>
            <span className="mt-1 block text-[13px] leading-5 text-ink-3">{p!.description}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] text-[var(--accent)]">
              Read <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 space-y-8">
        {pagesByGroup().map((g) => (
          <section key={g.group}>
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-3">{g.group}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {g.pages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/docs/${p.slug}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-ink">
                    <span className="text-[15px] font-medium text-ink">{p.title}</span>
                    <span className="hidden text-[13px] text-ink-3 sm:block">{p.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
