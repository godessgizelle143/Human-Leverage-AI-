import Link from 'next/link'
import clsx from 'clsx'
import type { JourneyStage } from '@/lib/hke/journey'

function Node({ stage, index, small }: { stage: JourneyStage; index: number; small: boolean }) {
  return (
    <span
      className={clsx(
        'relative z-10 grid shrink-0 place-items-center rounded-full font-bold transition',
        small ? 'h-5 w-5 text-[10px]' : 'h-9 w-9 text-sm',
        stage.state === 'done' && 'bg-brand-gold text-brand-black',
        stage.state === 'current' && 'bg-brand-pink text-brand-black shadow-glow-pink ring-4 ring-brand-pink/20',
        stage.state === 'upcoming' && 'border border-white/20 bg-brand-black text-white/45',
      )}
    >
      {stage.state === 'done' ? '✓' : index + 1}
    </span>
  )
}

/**
 * The connected path from capture to kit. `compact` is the card-sized version
 * (nodes and labels only); the full version adds each stage's saved progress.
 */
export default function JourneyRail({ stages, compact = false, className }: { stages: JourneyStage[]; compact?: boolean; className?: string }) {
  return (
    <ol className={clsx('grid', className)} style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Project journey">
      {stages.map((stage, index) => {
        const next = stages[index + 1]
        const body = (
          <>
            <span className="relative flex w-full items-center">
              <Node stage={stage} index={index} small={compact} />
              {next && (
                <span className={clsx('journey-link', stage.state === 'done' && next.state === 'done' && 'journey-link-done', stage.state === 'done' && next.state === 'current' && 'journey-link-flow')} aria-hidden>
                  {/* Knowledge in motion: the one turquoise mark on the rail. */}
                  {stage.state === 'done' && next.state === 'current' && <span className="status-dot journey-pulse" />}
                </span>
              )}
            </span>
            <span className={clsx('block pr-2', compact ? 'mt-1.5' : 'mt-3')}>
              <span className={clsx('block truncate font-semibold', compact ? 'text-[11px]' : 'text-sm', stage.state === 'upcoming' ? 'text-white/45' : 'text-white')}>{stage.label}</span>
              {!compact && (
                <>
                  <span className="mt-0.5 hidden text-xs leading-5 text-white/45 md:block">{stage.summary}</span>
                  <span className={clsx('mt-1 block truncate text-xs', stage.state === 'done' ? 'text-brand-gold' : stage.state === 'current' ? 'text-brand-pink' : 'text-white/35')}>{stage.detail}</span>
                </>
              )}
            </span>
          </>
        )
        return (
          <li key={stage.key} className="min-w-0" aria-current={stage.state === 'current' ? 'step' : undefined}>
            {stage.href && !compact
              ? <Link href={stage.href} className="group block rounded-lg outline-offset-4 transition hover:opacity-90">{body}</Link>
              : <div>{body}</div>}
          </li>
        )
      })}
    </ol>
  )
}
