import type { Metadata } from 'next'
import './globals.css'
import { DEMO_WRITE_MESSAGE, isDemoMode } from '@/lib/demo/mode'
import { bodyFontClass, fontVariables } from '@/lib/fonts'

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
    <html lang="en" className={fontVariables}>
      <body className={bodyFontClass}>
        {isDemoMode() && <div role="status" className="demo-banner">{DEMO_WRITE_MESSAGE}</div>}
        {children}
      </body>
    </html>
  )
}
