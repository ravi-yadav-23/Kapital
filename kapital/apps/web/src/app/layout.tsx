import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
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
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
