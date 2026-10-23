import clsx from 'clsx'
import { BRAND } from '@/lib/brand'

// Jewel positions along the crown band, left to right (viewBox 0 0 120 80).
const JEWELS = [18, 39, 60, 81, 102]

/**
 * The HKE crown drawing: a gold crown with five jewels on its band. `lit` is
 * either how many jewels glow from the left (the one at `current` is hot pink),
 * or one flag per jewel for earned jewels (all hot pink, like the gems). `filled` makes the
 * crown solid gold. Colors come from lib/brand.ts. Decorative unless `label` is given.
 */
export default function CrownArt({ lit, current, filled = false, label, className }: { lit: number | boolean[]; current?: number; filled?: boolean; label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={clsx('shrink-0 overflow-visible', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="hke-crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND.goldLight} />
          <stop offset="45%" stopColor={BRAND.gold} />
          <stop offset="75%" stopColor={BRAND.goldDeep} />
          <stop offset="100%" stopColor={BRAND.goldLight} />
        </linearGradient>
      </defs>
      <path
        d="M8 68 L8 30 L32 46 L46 12 L60 38 L74 12 L88 46 L112 30 L112 68 Z"
        fill={filled ? 'url(#hke-crown-gold)' : BRAND.gold}
        fillOpacity={filled ? 1 : 0.1}
        stroke="url(#hke-crown-gold)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="6" y="62" width="108" height="12" rx="3" fill="url(#hke-crown-gold)" />
      {JEWELS.map((x, index) => {
        const on = Array.isArray(lit) ? !!lit[index] : index < lit
        return (
          <circle
            key={x}
            cx={x}
            cy="68"
            r="4.5"
            className={on ? 'level-jewel-lit' : undefined}
            fill={on ? (Array.isArray(lit) || index === current ? BRAND.pink : BRAND.goldLight) : BRAND.raised}
            stroke={on ? BRAND.white : BRAND.line}
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}
