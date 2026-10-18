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
  description:
    'Stop guessing which IPO to apply to. Kapitl scores every IPO with AI, allocates your family’s capital mathematically, and manages the entire application workflow autonomously.',
  keywords: [
    'IPO',
    'IPO GMP',
    'SEBI IPO Allocation',
    'IPO Allotment Status',
    'Angel One SmartAPI',
    'DRHP AI Analysis',
    'Kapitl',
    'Indian Stock Market',
  ],
  authors: [{ name: 'Ravi Yadav' }],
  metadataBase: new URL('https://kapital-gamma-nine.vercel.app'),
  openGraph: {
    title: 'Kapitl — IPO Intelligence Platform',
    description:
      'Scores every Indian IPO 0-100 with AI, allocates family capital mathematically across SEBI categories, and executes listing-day exits.',
    url: 'https://kapital-gamma-nine.vercel.app',
    siteName: 'Kapitl',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Kapitl — IPO Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kapitl — IPO Intelligence Platform',
    description:
      'Autonomous IPO scoring, dynamic family allocation, and allotment tracking for Indian retail investors.',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
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

