import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'RJ FM — Live Radio',
  description:
    'RJ FM live radio. Select Manila, Naga, Cebu, Davao, or Iloilo for station-specific programming.',
  generator: 'v0.app',
  icons: {
    icon: '/rj-fm-logo.jpg',
    apple: '/rj-fm-logo.jpg',
    shortcut: '/rj-fm-logo.jpg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#14161f',
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fil" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
