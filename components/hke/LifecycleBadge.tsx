import clsx from 'clsx'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES, lifecycleStep, type LifecycleStage } from '@/lib/hke/lifecycle'

const STAGE_STYLES: Record<LifecycleStage, string> = {
  draft: 'border-white/15 text-white/60',
  interviewing: 'border-brand-gold/40 text-brand-gold',
  knowledge_extracted: 'border-brand-gold/60 text-brand-gold bg-brand-gold/10',
  blueprint_created: 'border-brand-pink/40 text-brand-pink',
  assets_generating: 'border-brand-pink/60 text-brand-pink bg-brand-pink/10 animate-pulse',
  assets_ready: 'border-brand-pink/60 text-white bg-brand-pink/20',
  archived: 'border-white/10 text-white/40',
}

export function LifecycleBadge({ stage, className }: { stage: LifecycleStage; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap', STAGE_STYLES[stage], className)}>
      {LIFECYCLE_LABELS[stage]}
    </span>
  )
}

const TRACK = LIFECYCLE_STAGES.filter((stage) => stage !== 'archived')

/** Horizontal progress through the HKE AI pipeline. */
export function LifecycleTrack({ stage }: { stage: LifecycleStage }) {
  const step = lifecycleStep(stage)
  return (
    <ol className="grid grid-cols-3 sm:grid-cols-6 gap-2" aria-label="Project progress">
      {TRACK.map((item, index) => {
        const done = index < step || (index === step && item === 'assets_ready')
        const active = index === step && !done
        return (
          <li key={item} className="min-w-0">
            <div className={clsx('h-1.5 rounded-full', done ? 'bg-gradient-brand' : active ? 'bg-brand-gold/60' : 'bg-white/10')} />
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
      {label && <div className="mb-1.5 flex justify-between text-xs text-white/50"><span>{label}</span>{showValue && <span>{value}%</span>}</div>}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-brand transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}
