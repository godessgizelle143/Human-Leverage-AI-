/**
 * HKE theme — the single source for every color and font role: Tailwind
 * (`tailwind.config.ts`), the CSS component classes in `app/globals.css`, SVG
 * art (`components/hke/CrownArt.tsx`), and the print-ready deliverables
 * (`lib/hke/markdown.ts`, `lib/hke/kit.ts`). Pages use the Tailwind names
 * (`text-brand-muted`, `bg-brand-surface`, …), never raw colors.
 *
 * Colors are taken from the approved "Crown" dashboard design
 * (HKE-Dashboard-Black-and-Gold.png): warm black, flat gold, hot pink.
 *
 * Roles:
 * - black / surface / raised: page, cards, and inset fills (tracks, pills).
 * - line / lineSoft: card borders and dividers.
 * - gold: buttons, fills, and completion. goldSoft: headings and links.
 *   goldPale: text on a gold wash. goldWash: the fill behind gold pills.
 *   goldLight / goldDeep: the highlight and shadow of metallic gold
 *   (GOLD_GRADIENT and the crown art).
 * - pink: hot pink — the current step, script accents, and highlights.
 * - text / body / muted / faint: warm white type, from titles down to fine print.
 * - turquoise / turquoiseDeep: legacy token names, now champagne-gold tones for
 *   the small status and knowledge-flow marks. The design has no turquoise.
 * - white: pure white for the few places that need full contrast.
 */
export const BRAND = {
  black: '#0B0A09',
  surface: '#16130F',
  raised: '#2A2218',
  line: '#6B5A36',
  lineSoft: '#3A3024',
  pink: '#FF4FA3',
  gold: '#E2B84A',
  goldSoft: '#E8C766',
  goldPale: '#F5DC8E',
  goldWash: '#2E2614',
  goldLight: '#FFE9A8',
  goldDeep: '#B8862B',
  text: '#F3EEE6',
  body: '#CFC6B8',
  muted: '#B8AFA2',
  faint: '#8C867D',
  turquoise: '#F7DFA0',
  turquoiseDeep: '#F2C96B',
  white: '#FFFFFF',
  // Print and paper tones for the exported documents.
  brass: '#a47b32',
  paper: '#f4efe4',
  ink: '#171512',
} as const

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.pink} 0%, ${BRAND.gold} 100%)`

// Polished metal: highlight, body, shadow, highlight — like the banner's gold lettering.
export const GOLD_GRADIENT = `linear-gradient(180deg, ${BRAND.goldLight} 0%, ${BRAND.gold} 42%, ${BRAND.goldDeep} 68%, ${BRAND.goldLight} 100%)`

/**
 * Font roles. The fonts themselves are loaded once in `lib/fonts.ts` (next/font
 * needs literal options there), which sets these CSS variables.
 * - body: Inter, for everything people read.
 * - display: Cinzel, carved Roman capitals for titles only.
 * - script: Yellowtail, neon script for a few accent words, never full sentences.
 */
export const BRAND_FONTS = {
  body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
  display: ['var(--font-display)', 'Georgia', 'serif'],
  script: ['var(--font-script)', 'cursive'],
} as const
