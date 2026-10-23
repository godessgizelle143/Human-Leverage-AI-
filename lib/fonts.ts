import { Cinzel, Fraunces, Inter, Yellowtail } from 'next/font/google'

/**
 * The HKE fonts, loaded once. Each sets the CSS variable that the font roles in
 * `lib/brand.ts` (BRAND_FONTS) point to. next/font needs literal options, so
 * the loaders live here rather than in the theme file.
 */
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

/** Class names for <html> that define every font variable. */
export const fontVariables = `${inter.variable} ${fraunces.variable} ${cinzel.variable} ${yellowtail.variable}`

/** Class name that applies the body font. */
export const bodyFontClass = inter.className
