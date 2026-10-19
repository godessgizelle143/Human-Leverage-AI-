/**
 * HKE AI brand palette — the single source for every surface: Tailwind
 * (`tailwind.config.ts`), the CSS component classes in `app/globals.css`, and
 * the print-ready deliverables (`lib/hke/markdown.ts`, `lib/hke/kit.ts`).
 *
 * Roles (matched to the HKE banner: black marble, metallic gold, neon pink):
 * - black / surface / raised: page background and workspace surfaces.
 * - pink: neon signature color — primary actions, current selection, key highlights.
 * - gold / goldLight / goldDeep: metallic gold — headings, premium details,
 *   achievement and completion. Use GOLD_GRADIENT for the polished-metal look.
 * - turquoise / turquoiseDeep: legacy token names, now champagne-gold tones for
 *   the small status and knowledge-flow marks. The banner has no turquoise.
 *   (Names kept so existing components need no edits; rename in a cleanup pass.)
 * - white: typography and contrast.
 */
export const BRAND = {
  black: '#0a0a0a',
  surface: '#121212',
  raised: '#1a1a1a',
  pink: '#FF2BB8',
  gold: '#F0C24B',
  goldLight: '#FFE9A8',
  goldDeep: '#B8862B',
  turquoise: '#F7DFA0',
  turquoiseDeep: '#F2C96B',
  white: '#FFFFFF',
} as const

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.pink} 0%, ${BRAND.gold} 100%)`

// Polished metal: highlight, body, shadow, highlight — like the banner's gold lettering.
export const GOLD_GRADIENT = `linear-gradient(180deg, ${BRAND.goldLight} 0%, ${BRAND.gold} 42%, ${BRAND.goldDeep} 68%, ${BRAND.goldLight} 100%)`
