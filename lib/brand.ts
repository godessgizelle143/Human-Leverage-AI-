/**
 * HKE AI brand palette — the single source for every surface: Tailwind
 * (`tailwind.config.ts`), the CSS component classes in `app/globals.css`, and
 * the print-ready deliverables (`lib/hke/markdown.ts`, `lib/hke/kit.ts`).
 *
 * Roles:
 * - black / surface / raised: page background and workspace surfaces.
 * - pink: signature color — primary actions, current selection, key highlights.
 * - gold: premium details, achievement and completion, refined accents.
 * - turquoise: restrained secondary accent (about 5% of accent use) — saved and
 *   ready status, knowledge-flow details. Never a button or a large fill.
 * - white: typography and contrast.
 */
export const BRAND = {
  black: '#0a0a0a',
  surface: '#121212',
  raised: '#1a1a1a',
  pink: '#FF1493',
  gold: '#D4AF37',
  turquoise: '#40E0D0',
  // The deeper of the two accent tones; used for fine details beside `turquoise`.
  turquoiseDeep: '#35D6C8',
  white: '#FFFFFF',
} as const

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.pink} 0%, ${BRAND.gold} 100%)`
