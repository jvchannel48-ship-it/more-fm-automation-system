import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'RJ FM Manila — Your Home of Music',
  description:
    'RJ FM Manila — Your Home of Music. Listen to RJ FM stations nationwide.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'RJ FM', statusBarStyle: 'black-translucent' },
  icons: {
    icon: '/rjfm-app-icon.svg',
    apple: '/rjfm-app-icon.svg',
    shortcut: '/rjfm-app-icon.svg',
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
        <PwaRegister />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
