import clsx from 'clsx'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES, lifecycleStep, type LifecycleStage } from '@/lib/hke/lifecycle'

const STAGE_STYLES: Record<LifecycleStage, string> = {
  draft: 'border-brand-line text-brand-muted',
  interviewing: 'border-brand-pink text-brand-text',
  // Knowledge in hand: the one stage marked with the champagne accent.
  knowledge_extracted: 'border-brand-turquoise/40 text-brand-turquoise',
  blueprint_created: 'border-brand-line bg-brand-goldWash text-brand-goldPale',
  assets_generating: 'border-brand-pink text-brand-text bg-brand-pink/10 animate-pulse',
  assets_ready: 'border-brand-line bg-brand-goldWash text-brand-goldPale',
  archived: 'border-brand-lineSoft text-brand-faint',
}

export function LifecycleBadge({ stage, className }: { stage: LifecycleStage; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap', STAGE_STYLES[stage], className)}>
      {LIFECYCLE_LABELS[stage]}
    </span>
  )
}

const TRACK = LIFECYCLE_STAGES.filter((stage) => stage !== 'archived')

/** Horizontal progress through the HKE pipeline. */
export function LifecycleTrack({ stage }: { stage: LifecycleStage }) {
  const step = lifecycleStep(stage)
  return (
    <ol className="grid grid-cols-3 sm:grid-cols-6 gap-2" aria-label="Project progress">
      {TRACK.map((item, index) => {
        const done = index < step || (index === step && item === 'assets_ready')
        const active = index === step && !done
        return (
          <li key={item} className="min-w-0">
            <div className={clsx('h-1.5 rounded-full', done ? 'bg-brand-gold' : active ? 'bg-brand-pink' : 'bg-white/10')} />
            <p className={clsx('mt-2 text-[11px] leading-tight', done || active ? 'text-white/80' : 'text-white/35')}>{LIFECYCLE_LABELS[item]}</p>
          </li>
        )
      })}
    </ol>
  )
}

export function ProgressMeter({ value, label, showValue = true }: { value: number; label?: string; showValue?: boolean }) {
  return (
    <div>
      {label && <div className="mb-1.5 flex justify-between text-xs text-brand-muted"><span>{label}</span>{showValue && <span>{value}%</span>}</div>}
      <div className="h-1.5 rounded-full bg-brand-raised overflow-hidden">
        <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}
