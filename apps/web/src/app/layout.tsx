import type { Metadata } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import '../styles/globals.css'
import { AppProviders } from '@/components/providers/AppProviders'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Kapitl — IPO Intelligence Platform',
  description: 'Personal IPO investment automation — scoring, fund management, allotment tracking, pre-listing sell.',
  keywords: ['IPO', 'investment', 'Angel One', 'allotment', 'GMP', 'DRHP', 'Kapitl'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} ${inter.className}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

