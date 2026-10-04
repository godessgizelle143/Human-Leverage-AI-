import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'

/** Top bar for signed-in HKE AI pages. */
export default function AppHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-black/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-[10px] font-black text-brand-black">HKE</span>
            <span className="hidden font-bold sm:inline">HKE <span className="gradient-text">AI</span></span>
          </Link>
          {backHref && <Link href={backHref} className="truncate text-sm text-white/60 hover:text-white">← {backLabel ?? 'Back'}</Link>}
        </div>
        <SignOutButton compact />
      </div>
    </header>
  )
}
