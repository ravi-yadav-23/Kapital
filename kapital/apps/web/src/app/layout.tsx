import type { Metadata } from 'next'
import '../styles/globals.css'

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
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}
