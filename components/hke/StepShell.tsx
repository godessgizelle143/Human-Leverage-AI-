'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import clsx from 'clsx'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from './AppHeader'
import type { StepFormStatus } from './useStepForm'

/** Shared frame for the four launch-plan step forms: header, position in the plan, title. */
export default function StepShell({ step, title, description, children }: { step: number; title: string; description: React.ReactNode; children: React.ReactNode }) {
  // A link, not history.back(): this page is often opened from the dashboard or a bookmark.
  const { id: projectId } = useParams<{ id: string }>()
  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href={`/projects/${projectId}#plan`} className="link-quiet mb-8 inline-block text-sm">
          ← Back to your launch plan
        </Link>
        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Launch plan steps">
          {STEP_SECTIONS.map((section, index) => {
            const position = index + 1
            return (
              <li key={section.key} className="min-w-0" aria-current={position === step ? 'step' : undefined}>
                <div className={clsx('h-1 rounded-full', position < step ? 'bg-brand-gold' : position === step ? 'bg-brand-pink' : 'bg-white/10')} />
                <p className={clsx('mt-2 truncate text-[11px]', position === step ? 'text-white' : 'text-white/40')}>{section.label}</p>
              </li>
            )
          })}
        </ol>
        <p className="eyebrow">Step {String(step).padStart(2, '0')} of {String(STEP_SECTIONS.length).padStart(2, '0')}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="mb-8 mt-3 leading-7 text-white/60">{description}</p>
        <div className="glass rounded-2xl p-5 sm:p-8">{children}</div>
      </div>
    </main>
  )
}

/** Load and save state for a step form; the form stays locked until saved answers load. */
export function StepFormAlert({ status, error, onRetry }: { status: StepFormStatus; error: string; onRetry: () => void }) {
  if (!error) return null
  return (
    <div role="alert" className="notice notice-error">
      <p>{error}</p>
      {status === 'load-error' && <button type="button" onClick={onRetry} className="link-action mt-2 text-sm">Try loading again</button>}
    </div>
  )
}
