import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator, Database, LayoutDashboard, ShieldCheck, Terminal } from 'lucide-react'
import { DOC_PAGES, pagesByGroup } from '@/lib/docs-content'
import { DocDiagram } from '@/components/docs/DocDiagrams'

const START = ['quickstart', 'listing-gain-score', 'score-walkthrough']

const GROUP_META: Record<string, { Icon: typeof BookOpen; blurb: string }> = {
  'Start here': { Icon: BookOpen, blurb: 'What Kapitl is, a first session and the words used throughout.' },
  'Using Kapitl': { Icon: LayoutDashboard, blurb: 'Every screen in the app and what to do on it.' },
  'How scoring works': { Icon: Calculator, blurb: 'The listing-gain score, red flags, document reading and allotment odds.' },
  'Data and automation': { Icon: Database, blurb: 'Sources, the fallback ladder, the nightly run and every scheduled job.' },
  'Money and accounts': { Icon: ShieldCheck, blurb: 'ASBA locks, the life of an application, and security.' },
  'Run it yourself': { Icon: Terminal, blurb: 'API, local setup, configuration, deployment, limits and FAQ.' },
}

export default function DocsIndexPage() {
  const featured = START.map((s) => DOC_PAGES.find((p) => p.slug === s)).filter(Boolean)
  return (
    <main className="max-w-4xl">
      <p className="text-[13px] font-medium text-[var(--accent-text,var(--accent))]">Documentation</p>
      <h1 className="mt-2 text-[36px] font-semibold leading-tight tracking-tight text-ink">Kapitl documentation</h1>
      <p className="mt-3 max-w-3xl text-[17px] leading-7 text-ink-2">
        Kapitl helps Indian retail investors decide which IPOs to apply to for a listing-day gain and how to split capital
        across family demat accounts. These pages explain every screen, how the score is built, where the data comes from and
        how to run it yourself.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/docs/quickstart" className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
          Get started <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/docs/overview" className="inline-flex items-center rounded-sm border border-line px-4 py-2 text-[14px] text-ink hover:border-line-strong">
          What Kapitl is
        </Link>
      </div>

      <h2 className="mt-12 text-[13px] font-medium uppercase tracking-wide text-ink-3">Start with</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {featured.map((p) => (
          <Link
            key={p!.slug}
            href={`/docs/${p!.slug}`}
            className="group rounded-md border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
          >
            <span className="block text-[15px] font-medium text-ink">{p!.title}</span>
            <span className="mt-1 block text-[13px] leading-5 text-ink-3">{p!.description}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] text-[var(--accent-text,var(--accent))]">
              Read <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-12 text-[13px] font-medium uppercase tracking-wide text-ink-3">How it fits together</h2>
      <div className="mt-3">
        <DocDiagram name="pipeline" caption="All model work happens in one nightly job. Opening a report only reads what is stored." />
      </div>

      <h2 className="mt-12 text-[13px] font-medium uppercase tracking-wide text-ink-3">Browse by section</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {pagesByGroup().map((g) => {
          const meta = GROUP_META[g.group]
          const Icon = meta?.Icon ?? BookOpen
          return (
            <section key={g.group} className="rounded-md border border-line p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-raised">
                  <Icon className="h-4 w-4 text-[var(--accent-text,var(--accent))]" aria-hidden />
                </span>
                <h3 className="text-[16px] font-semibold text-ink">{g.group}</h3>
              </div>
              {meta && <p className="mt-2 text-[13px] leading-5 text-ink-3">{meta.blurb}</p>}
              <ul className="mt-3 space-y-1">
                {g.pages.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/docs/${p.slug}`} className="group flex items-center gap-1.5 py-0.5 text-[14px] text-ink-2 hover:text-ink">
                      <ArrowRight className="h-3 w-3 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}
