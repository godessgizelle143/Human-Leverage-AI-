import clsx from 'clsx'
import type { Crown } from '@/lib/hke/jewels'
import CrownArt from './CrownArt'

/**
 * "Your crown": one jewel per "Your path" stage, lit as each stage is done,
 * with a script line naming the next one. Full width, under the path.
 */
export default function CrownCard({ crown, className }: { crown: Crown; className?: string }) {
  return (
    <section className={clsx('dash-card relative overflow-hidden p-6 sm:p-8', className)} aria-labelledby="crown-title">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
        <div className="relative flex shrink-0 items-center gap-5">
          <span className="relative">
            <CrownArt lit={crown.jewels.map((jewel) => jewel.earned)} filled={crown.next === null} className="h-20 w-[120px]" />
            <span className="crown-butterfly -right-4 -top-3" aria-hidden>🦋</span>
          </span>
          <div className="md:hidden">
            <h2 className="dash-title text-2xl">Your crown</h2>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="crown-title" className="dash-title hidden text-2xl md:block">Your crown</h2>
          <p className="mt-2 text-brand-body">Every win adds a jewel. <span className="font-semibold text-brand-text">{crown.earned} of {crown.jewels.length}</span> earned.</p>
          <p className="mt-3 font-script text-2xl text-brand-pink sm:text-3xl">{crown.line}</p>
        </div>

        <ol className="grid shrink-0 grid-cols-5 gap-3 sm:gap-5" aria-label={`Jewels: ${crown.earned} of ${crown.jewels.length} earned`}>
          {crown.jewels.map((jewel) => {
            const isNext = crown.next?.key === jewel.key
            return (
              <li key={jewel.key} className="flex flex-col items-center gap-3 text-center">
                <span className={clsx('gem', jewel.earned && 'gem-earned', isNext && 'gem-next')} aria-hidden />
                <span className={clsx('text-[11px] leading-tight', jewel.earned ? 'text-brand-text' : 'text-brand-faint')}>
                  {jewel.label}
                  <span className="sr-only">{jewel.earned ? ': earned' : isNext ? ': next' : ': not yet'}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
