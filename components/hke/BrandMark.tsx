import clsx from 'clsx'

const SIZES = {
  sm: { mark: 'h-8 w-8 text-[10px]', word: 'text-base' },
  md: { mark: 'h-9 w-9 text-[11px]', word: 'text-lg sm:text-xl' },
  lg: { mark: 'h-11 w-11 text-[13px]', word: 'text-2xl' },
}

/** The HKE AI logo: the gradient mark, with the wordmark beside it unless hidden. */
export default function BrandMark({ size = 'md', wordmark = true, wordmarkClassName, tagline = false }: { size?: keyof typeof SIZES; wordmark?: boolean; wordmarkClassName?: string; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={clsx('brand-mark shrink-0', SIZES[size].mark)} aria-hidden={wordmark}>HKE</span>
      {wordmark && (
        <span className={clsx('font-bold tracking-tight', SIZES[size].word, wordmarkClassName)}>
          HKE <span className="neon-pink font-script text-[1.15em] font-normal">AI</span>
          {tagline && <span className="gold-text ml-2 hidden font-display text-xs font-bold uppercase tracking-[.18em] lg:inline">Human Knowledge Engine</span>}
        </span>
      )}
    </span>
  )
}
