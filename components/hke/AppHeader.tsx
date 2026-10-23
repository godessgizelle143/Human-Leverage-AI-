import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'
import CrownArt from './CrownArt'

/** Top bar for signed-in HKE pages: the crown and the full name, in gold. */
export default function AppHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-lineSoft bg-brand-black/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3" aria-label="The Human Knowledge Engine dashboard">
            <CrownArt lit={5} current={2} filled className="h-8 w-12" />
            <span className="dash-title text-sm uppercase tracking-[.12em] sm:text-base" aria-hidden>
              <span className="sm:hidden">HKE</span>
              <span className="hidden sm:inline">The Human Knowledge Engine</span>
            </span>
          </Link>
          {backHref && <Link href={backHref} className="link-quiet truncate text-sm">← {backLabel ?? 'Back'}</Link>}
        </div>
        <SignOutButton compact />
      </div>
    </header>
  )
}
