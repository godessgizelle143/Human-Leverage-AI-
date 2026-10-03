import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
