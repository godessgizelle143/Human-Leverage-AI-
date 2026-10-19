import type { Metadata } from 'next'
import { Cinzel, Fraunces, Inter, Yellowtail } from 'next/font/google'
import './globals.css'
import { DEMO_WRITE_MESSAGE, isDemoMode } from '@/lib/demo/mode'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

// Banner lettering: carved Roman capitals for titles, neon script for a few accent words.
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const yellowtail = Yellowtail({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Human Knowledge Engine AI (HKE AI) — Speak Once. Build Forever.',
  description: 'Transform your knowledge into digital products, marketing assets, and business resources with Human Knowledge Engine AI.',
  keywords: ['AI', 'business automation', 'content generation', 'digital products', 'Human Knowledge Engine AI', 'HKE AI'],
  openGraph: {
    title: 'Human Knowledge Engine AI (HKE AI) — Speak Once. Build Forever.',
    description: 'Turn what you know into assets you can use, share, and sell.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${cinzel.variable} ${yellowtail.variable}`}>
      <body className={inter.className}>
        {isDemoMode() && <div role="status" className="demo-banner">{DEMO_WRITE_MESSAGE}</div>}
        {children}
      </body>
    </html>
  )
}
