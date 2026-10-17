import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'
import BrandMark from './BrandMark'

/** Top bar for signed-in HKE AI pages. */
export default function AppHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-black/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="flex items-center shrink-0" aria-label="HKE AI dashboard">
            <BrandMark size="sm" wordmarkClassName="hidden sm:inline" />
          </Link>
          {backHref && <Link href={backHref} className="link-quiet truncate text-sm">← {backLabel ?? 'Back'}</Link>}
        </div>
        <SignOutButton compact />
      </div>
    </header>
  )
}
