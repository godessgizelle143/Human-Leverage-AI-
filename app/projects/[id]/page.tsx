import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'
import { getUserUsage } from '@/lib/hke/access'
import { blueprintEntries, stepEntries } from '@/lib/hke/blueprint'
import { canGenerateAsset } from '@/lib/hke/entitlements'
import { answeredCount, parseInterviewMessages, TOTAL_QUESTIONS } from '@/lib/hke/interview'
import { assembleKnowledge } from '@/lib/hke/knowledge'
import { deriveLifecycle } from '@/lib/hke/lifecycle'
import { listProjectAssets, loadOwnedProject } from '@/lib/hke/projects'
import { isUuid } from '@/lib/hke/server'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from '@/components/hke/AppHeader'
import ArchiveButton from '@/components/hke/ArchiveButton'
import AssetStudio from '@/components/hke/AssetStudio'
import RefreshButton from '@/components/hke/RefreshButton'
import UsagePanel from '@/components/hke/UsagePanel'
import { LifecycleBadge, LifecycleTrack, ProgressMeter } from '@/components/hke/LifecycleBadge'

export const dynamic = 'force-dynamic'

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isUuid(params.id)) redirect('/dashboard')

  const project = await loadOwnedProject(supabase, user.id, params.id)
  if (!project) redirect('/dashboard')

  const [{ data: interview }, assets, { usage }] = await Promise.all([
    supabase.from('interviews').select('id, status, messages').eq('id', project.interview_id).eq('user_id', user.id).maybeSingle(),
    listProjectAssets(supabase, user.id, project.id),
    getUserUsage(supabase, user),
  ])

  const { answers } = parseInterviewMessages(interview?.messages)
  const answered = answeredCount(answers)
  const stage = deriveLifecycle(interview, project, assets)
  const archived = !!project.archived_at
  const building = project.status !== 'completed'
  const knowledge = assembleKnowledge(project, answers)
  const blueprint = blueprintEntries(project.content)

  const recommended = Array.isArray(project.content.recommended_modules)
    ? project.content.recommended_modules.map((id) => HLAI_CAPABILITIES.find((capability) => capability.id === id)).filter((capability): capability is (typeof HLAI_CAPABILITIES)[number] => Boolean(capability))
    : []

  const steps = STEP_SECTIONS.map((step) => ({ ...step, entries: stepEntries(project.content, step.key) }))
  const nextStep = steps.find((step) => !step.entries?.length)
  const pitch = blueprint.find((entry) => entry.key === 'elevator_pitch')
  const completedAssets = assets.filter((asset) => asset.status === 'completed').length

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-brand-gold text-sm font-semibold">HKE AI PROJECT</p>
              <LifecycleBadge stage={stage} />
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold break-words">{project.title}</h1>
            {pitch && typeof pitch.value === 'string' && <p className="mt-3 max-w-3xl text-white/65 leading-7">{pitch.value}</p>}
          </div>
          {!building && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm lg:justify-end">
              <a href={`/api/projects/${project.id}/export?format=md`} className="text-white/70 hover:text-white">Download blueprint (.md)</a>
              <a href={`/api/projects/${project.id}/export?format=html`} className="text-white/70 hover:text-white">Printable (.html)</a>
              <ArchiveButton kind="project" id={project.id} archived={archived} />
            </div>
          )}
        </div>

        <div className="mt-8"><LifecycleTrack stage={stage} /></div>

        {building ? (
          <div className="mt-8 rounded-2xl border border-brand-pink/30 bg-brand-pink/5 p-6">
            <p className="font-semibold">HKE AI is extracting your knowledge into a blueprint…</p>
            <p className="mt-2 text-sm text-white/60">This usually takes under a minute. If it was interrupted, your credits are refunded automatically and you can build again from the interview.</p>
            <div className="mt-4 flex flex-wrap gap-4">
              <RefreshButton />
              <Link href={`/builder?interview=${project.interview_id}`} className="text-sm text-white/60 hover:text-white">Back to interview</Link>
            </div>
          </div>
        ) : (
          <>
            {archived && <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/60">This project is archived. Everything is preserved — restore it to keep building.</div>}

            <div className="mt-8 rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 via-transparent to-brand-pink/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-gold">Continue where you left off</p>
              {nextStep ? (
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-lg font-semibold">Next: {nextStep.label}</p>
                  <Link href={`/projects/${project.id}/${nextStep.path}`} className="btn-primary justify-center">Continue →</Link>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-lg font-semibold">{completedAssets ? 'Your plan is complete. Keep building assets from your knowledge.' : 'Your plan is complete. Generate your first asset below.'}</p>
                  <a href="#assets" className="btn-primary justify-center">Go to assets →</a>
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-6 min-w-0">
                <section className="glass rounded-2xl p-5 sm:p-7">
                  <p className="text-brand-pink text-xs font-semibold uppercase tracking-wider">Understand · structured knowledge</p>
                  <h2 className="text-2xl font-bold">What HKE AI knows</h2>
                  <p className="mt-1 text-sm text-white/50">{knowledge.items.length} knowledge items from {knowledge.sources.map((source) => source.label.toLowerCase()).join(', ') || 'no sources yet'}.</p>
                  {blueprint.length ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {blueprint.filter((entry) => entry.key !== 'elevator_pitch').map((entry) => (
                        <article key={entry.key} className="rounded-xl border border-white/10 bg-white/[.03] p-4 min-w-0">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-gold">{entry.label}</h3>
                          {typeof entry.value === 'string' ? (
                            <p className="mt-2 text-white/75 leading-7 whitespace-pre-wrap break-words">{entry.value}</p>
                          ) : (
                            <ul className="mt-2 space-y-1.5 text-white/75 leading-6">
                              {entry.value.map((item, index) => (
                                <li key={index} className="flex gap-2 break-words"><span className="text-brand-pink">•</span><span>{typeof item === 'string' ? item : <><strong className="text-white">{item.label}:</strong> {item.value}</>}</span></li>
                              ))}
                            </ul>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-white/60">No blueprint content was saved for this project.</p>
                  )}
                </section>

                <div id="assets" className="scroll-mt-24">
                  <AssetStudio projectId={project.id} initialAssets={assets} archived={archived} canGenerate={canGenerateAsset(usage)} buildsRemaining={usage?.builds.remaining ?? 0} hasPlan={!!usage?.active} />
                </div>
              </div>

              <aside className="space-y-6">
                <UsagePanel usage={usage} compact />

                <section className="glass rounded-2xl p-5">
                  <h2 className="font-semibold">Launch plan</h2>
                  <ol className="mt-4 space-y-3">
                    {steps.map((step, index) => {
                      const done = !!step.entries?.length
                      return (
                        <li key={step.key}>
                          <Link href={`/projects/${project.id}/${step.path}`} className="flex items-start gap-3 rounded-xl border border-white/10 p-3 transition hover:border-brand-gold/40">
                            <span className={done ? 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-brand text-xs font-bold text-brand-black' : 'grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/20 text-xs text-white/60'}>{done ? '✓' : index + 1}</span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{step.label}</span>
                              <span className="block text-xs text-white/50 truncate">{done ? step.entries![0].value : 'Not started'}</span>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ol>
                </section>

                <section className="glass rounded-2xl p-5">
                  <h2 className="font-semibold">Knowledge interview</h2>
                  <div className="mt-3"><ProgressMeter value={Math.round((answered / TOTAL_QUESTIONS) * 100)} label={`${answered} of ${TOTAL_QUESTIONS} answered`} /></div>
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-sm text-brand-gold">View your answers</summary>
                    <dl className="mt-3 space-y-3">
                      {INTERVIEW_QUESTIONS.map((question) => (
                        <div key={question.id}>
                          <dt className="text-xs text-white/50">{question.question}</dt>
                          <dd className="mt-0.5 text-sm text-white/80 whitespace-pre-wrap break-words">{answers[String(question.id)]?.trim() || <span className="text-white/30">Not answered</span>}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </section>

                {recommended.length > 0 && (
                  <section className="glass rounded-2xl p-5">
                    <h2 className="font-semibold">Recommended capabilities</h2>
                    <ul className="mt-3 space-y-3">
                      {recommended.map((capability) => (
                        <li key={capability.id}>
                          <p className="text-sm font-semibold">{capability.name} {capability.stage === 'planned' && <span className="ml-1 text-xs font-normal text-white/40">coming soon</span>}</p>
                          <p className="text-xs text-white/50 leading-5">{capability.description}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
