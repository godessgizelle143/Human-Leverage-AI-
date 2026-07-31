import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: 'Human Leverage AI™ — Speak Once. Build Forever.',
  description: 'Transform a single conversation into a complete digital business. AI-powered interviews that generate websites, content, and marketing materials automatically.',
  keywords: ['AI', 'business automation', 'content generation', 'SaaS', 'digital business'],
  openGraph: {
    title: 'Human Leverage AI™ — Speak Once. Build Forever.',
    description: 'Transform a single conversation into a complete digital business.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
