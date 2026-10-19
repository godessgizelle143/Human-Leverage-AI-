import clsx from 'clsx'
import type { Level } from '@/lib/hke/levels'

// Jewel positions along the crown band, left to right (viewBox 0 0 120 80).
const JEWELS = [18, 39, 60, 81, 102]

const SIZES = {
  sm: { crown: 'h-6 w-9', name: 'text-xs', tagline: '' },
  md: { crown: 'h-10 w-[60px]', name: 'text-sm', tagline: 'text-xs' },
  lg: { crown: 'h-16 w-24', name: 'text-lg', tagline: 'text-sm' },
}

/**
 * The build crown: five jewels, one per journey stage. Jewels up to the
 * current level glow; the rest wait, dim. The crown is fully gold once Crowned.
 */
export default function LevelCrown({ level, size = 'md', showName = true, showTagline = false, className }: { level: Level; size?: keyof typeof SIZES; showName?: boolean; showTagline?: boolean; className?: string }) {
  const crowned = level.number === 5
  const s = SIZES[size]
  return (
    <span className={clsx('inline-flex items-center gap-3', className)}>
      <svg viewBox="0 0 120 80" className={clsx('shrink-0 overflow-visible', s.crown, crowned && 'level-crown-crowned')} role="img" aria-label={`Level ${level.number} of 5: ${level.name}`}>
        <defs>
          <linearGradient id="hke-crown-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE9A8" />
            <stop offset="45%" stopColor="#F0C24B" />
            <stop offset="75%" stopColor="#B8862B" />
            <stop offset="100%" stopColor="#FFE9A8" />
          </linearGradient>
        </defs>
        <path
          d="M8 68 L8 30 L32 46 L46 12 L60 38 L74 12 L88 46 L112 30 L112 68 Z"
          fill={crowned ? 'url(#hke-crown-gold)' : 'rgba(240,194,75,0.10)'}
          stroke="url(#hke-crown-gold)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="6" y="62" width="108" height="12" rx="3" fill="url(#hke-crown-gold)" />
        {JEWELS.map((x, index) => {
          const lit = index < level.number
          return (
            <circle
              key={x}
              cx={x}
              cy="68"
              r="4.5"
              className={lit ? 'level-jewel-lit' : undefined}
              fill={lit ? (index === level.number - 1 ? '#FF2BB8' : '#FFE9A8') : '#2a2416'}
              stroke={lit ? '#FFFFFF' : '#5c4a22'}
              strokeWidth="1"
            />
          )
        })}
      </svg>
      {showName && (
        <span className="min-w-0">
          <span className={clsx('gold-text block font-display font-bold uppercase tracking-[.14em]', s.name)}>Level {level.number} · {level.name}</span>
          {showTagline && s.tagline && <span className={clsx('mt-0.5 block text-white/60', s.tagline)}>{level.tagline}</span>}
        </span>
      )}
    </span>
  )
}
