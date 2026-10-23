import clsx from 'clsx'
import type { Level } from '@/lib/hke/levels'
import CrownArt from './CrownArt'

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
      <CrownArt lit={level.number} current={level.number - 1} filled={crowned} label={`Level ${level.number} of 5: ${level.name}`} className={clsx(s.crown, crowned && 'level-crown-crowned')} />
      {showName && (
        <span className="min-w-0">
          <span className={clsx('gold-text block font-display font-bold uppercase tracking-[.14em]', s.name)}>Level {level.number} · {level.name}</span>
          {showTagline && s.tagline && <span className={clsx('mt-0.5 block text-brand-muted', s.tagline)}>{level.tagline}</span>}
        </span>
      )}
    </span>
  )
}
