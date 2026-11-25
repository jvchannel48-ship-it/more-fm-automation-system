import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'YS FM 107.1 — YOUR HOME OF ROMANTIC MUSIC',
  description: 'YS FM 107.1 livestream. YOUR HOME OF ROMANTIC MUSIC.',
  generator: 'v0.app',
  icons: {
    icon: '/ys-fm-logo.svg',
    shortcut: '/ys-fm-logo.svg',
    apple: '/ys-fm-logo.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#061b3a',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fil" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
