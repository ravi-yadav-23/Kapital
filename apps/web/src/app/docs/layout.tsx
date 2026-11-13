import type { Metadata } from 'next'
import { DocsShell } from '@/components/docs/DocsShell'

export const metadata: Metadata = {
  title: 'Documentation — Kapitl',
  description: 'How Kapitl scores IPOs for listing-day gain, where its data comes from, and how to run it.',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>
}
