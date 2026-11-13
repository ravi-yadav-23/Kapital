import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { DocBlocks } from '@/components/docs/DocBlocks'
import { OnThisPage } from '@/components/docs/OnThisPage'
import { DOC_PAGES, findPage, headingsOf, prevNext } from '@/lib/docs-content'

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = findPage(params.slug)
  return page ? { title: `${page.title} — Kapitl Docs`, description: page.description } : {}
}

export default function DocPage({ params }: { params: { slug: string } }) {
  const page = findPage(params.slug)
  if (!page) notFound()
  const { prev, next } = prevNext(page.slug)
  const headings = headingsOf(page)

  return (
    <div className="flex gap-10">
      <main className="min-w-0 max-w-[720px] flex-1">
        <p className="text-[13px] text-ink-3">{page.group}</p>
        <h1 className="mt-1 text-[30px] font-semibold tracking-tight text-ink">{page.title}</h1>
        <p className="mt-2 text-[16px] leading-7 text-ink-2">{page.description}</p>
        <div className="mt-8">
          <DocBlocks blocks={page.blocks} />
        </div>

        <nav aria-label="Previous and next page" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="rounded-sm border border-line p-3 hover:border-line-strong">
              <span className="flex items-center gap-1 text-[12px] text-ink-3"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Previous</span>
              <span className="mt-1 block text-[14px] font-medium text-ink">{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/docs/${next.slug}`} className="rounded-sm border border-line p-3 text-right hover:border-line-strong">
              <span className="flex items-center justify-end gap-1 text-[12px] text-ink-3">Next <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
              <span className="mt-1 block text-[14px] font-medium text-ink">{next.title}</span>
            </Link>
          ) : <span />}
        </nav>
      </main>

      <aside className="sticky top-20 hidden h-fit w-56 shrink-0 xl:block">
        <OnThisPage items={headings} />
      </aside>
    </div>
  )
}
