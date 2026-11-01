import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '../styles/globals.css'
import { AppProviders } from '@/components/providers/AppProviders'

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
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistSans.className}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var params = new URLSearchParams(window.location.search);
                var theme = params.get('theme') || localStorage.getItem('kapitl_theme');
                if (theme === 'light') {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

