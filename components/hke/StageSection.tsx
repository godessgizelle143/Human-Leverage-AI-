import clsx from 'clsx'
import type { JourneyState } from '@/lib/hke/journey'

/**
 * One stop on the project workspace's spine: a numbered node joined to the
 * next section by a line, so the page reads as one path from capture to kit.
 */
export default function StageSection({ id, index, state, label, title, summary, aside, last = false, children }: {
  id: string
  index: number
  state: JourneyState
  label: string
  title: string
  summary?: React.ReactNode
  aside?: React.ReactNode
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} className="relative scroll-mt-24 sm:pl-16" aria-labelledby={`${id}-title`}>
      <div className="absolute left-0 top-0 hidden h-full w-10 sm:block" aria-hidden>
        {!last && <span className={clsx('absolute left-1/2 top-10 -bottom-10 w-px -translate-x-1/2', state === 'done' ? 'bg-brand-gold/50' : 'bg-white/10')} />}
        <span
          className={clsx(
            'relative grid h-10 w-10 place-items-center rounded-full text-sm font-bold',
            state === 'done' && 'bg-brand-gold text-brand-black',
            state === 'current' && 'bg-brand-pink text-brand-black shadow-glow-pink ring-4 ring-brand-pink/20',
            state === 'upcoming' && 'border border-white/20 bg-brand-black text-white/50',
          )}
        >
          {state === 'done' ? '✓' : index}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className={clsx('eyebrow', state === 'current' && 'eyebrow-pink')}><span className="sm:hidden">{String(index).padStart(2, '0')} · </span>{label}</p>
          <h2 id={`${id}-title`} className="mt-1 text-2xl font-bold">{title}</h2>
          {summary && <p className="mt-1 text-sm text-white/55">{summary}</p>}
        </div>
        {aside && <div className="shrink-0 text-sm text-white/55">{aside}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
