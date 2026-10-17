'use client'

import { startTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * A project page whose saved data could not be read. This is shown instead of
 * an empty project, which would look as if the customer's work were gone.
 */
export default function ProjectLoadError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const retry = () => startTransition(() => { router.refresh(); reset() })

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <div className="mx-auto max-w-xl px-4 py-24 sm:px-6">
        <div role="alert" className="glass rounded-2xl p-6 sm:p-8">
          <p className="eyebrow eyebrow-pink">Could not load this project</p>
          <h1 className="mt-2 text-2xl font-bold">Your work is safe. We just couldn&apos;t read it right now.</h1>
          <p className="mt-3 text-white/60">Nothing was changed or deleted. This is usually temporary; try again in a moment.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={retry} className="btn-primary justify-center">Try again</button>
            <Link href="/dashboard" className="btn-secondary justify-center">Back to dashboard</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
