import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'
import { getUserUsage } from '@/lib/hke/access'
import { blueprintEntries, stepEntries } from '@/lib/hke/blueprint'
import { canGenerateAsset } from '@/lib/hke/entitlements'
import { isStaleBlueprintBuild } from '@/lib/hke/generation/recovery'
import { answeredCount, parseInterviewMessages, TOTAL_QUESTIONS } from '@/lib/hke/interview'
import { assembleKnowledge } from '@/lib/hke/knowledge'
import { buildJourney, currentStage, type JourneyKey } from '@/lib/hke/journey'
import { deriveLifecycle } from '@/lib/hke/lifecycle'
import { listProjectAssets, loadOwnedProject } from '@/lib/hke/projects'
import { isUuid } from '@/lib/hke/server'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from '@/components/hke/AppHeader'
import ArchiveButton from '@/components/hke/ArchiveButton'
import AssetStudio from '@/components/hke/AssetStudio'
import JourneyRail from '@/components/hke/JourneyRail'
import KnowledgeKitPanel from '@/components/hke/KnowledgeKitPanel'
import RefreshButton from '@/components/hke/RefreshButton'
import StageSection from '@/components/hke/StageSection'
import UsagePanel from '@/components/hke/UsagePanel'
import { LifecycleBadge, ProgressMeter } from '@/components/hke/LifecycleBadge'

export const dynamic = 'force-dynamic'

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isUuid(params.id)) redirect('/dashboard')

  const project = await loadOwnedProject(supabase, user.id, params.id)
  if (!project) redirect('/dashboard')

  const [{ data: interview, error: interviewError }, assets, { usage }] = await Promise.all([
    supabase.from('interviews').select('id, status, messages').eq('id', project.interview_id).eq('user_id', user.id).maybeSingle(),
    listProjectAssets(supabase, user.id, project.id),
    getUserUsage(supabase, user),
  ])

  // Shown by app/projects/error.tsx; otherwise every answer would read "Not answered".
  if (interviewError) throw new Error('The interview for this project could not be loaded.')
  const { answers } = parseInterviewMessages(interview?.messages)
  const answered = answeredCount(answers)
  const stage = deriveLifecycle(interview, project, assets)
  const archived = !!project.archived_at
  const building = project.status !== 'completed'
  const interrupted = isStaleBlueprintBuild(project)
  const knowledge = assembleKnowledge(project, answers)
  const blueprint = blueprintEntries(project.content)

  const recommended = Array.isArray(project.content.recommended_modules)
    ? project.content.recommended_modules.map((id) => HLAI_CAPABILITIES.find((capability) => capability.id === id)).filter((capability): capability is (typeof HLAI_CAPABILITIES)[number] => Boolean(capability))
    : []

  const steps = STEP_SECTIONS.map((step) => ({ ...step, entries: stepEntries(project.content, step.key) }))
  const nextStep = steps.find((step) => !step.entries?.length)
  const pitch = blueprint.find((entry) => entry.key === 'elevator_pitch')
  const completedAssets = assets.filter((asset) => asset.status === 'completed').length
  const planStepsDone = steps.filter((step) => step.entries?.length).length

  // The same five stages the dashboard shows, so this page reads as one path.
  const journey = buildJourney({ answered, projectId: project.id, blueprint: building ? 'building' : 'ready', stepsDone: planStepsDone, nextStepPath: nextStep?.path, assetsReady: completedAssets })
  const next = currentStage(journey)
  const stateOf = (key: JourneyKey) => journey.find((item) => item.key === key)!.state

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">HKE AI project</p>
              <LifecycleBadge stage={stage} />
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight break-words sm:text-5xl">{project.title}</h1>
            {pitch && typeof pitch.value === 'string' && <p className="mt-4 max-w-3xl text-lg leading-8 text-white/65">{pitch.value}</p>}
          </div>
          {!building && <div className="shrink-0 text-sm"><ArchiveButton kind="project" id={project.id} archived={archived} /></div>}
        </div>

        {archived && <div className="notice mt-6">This project is archived. Everything is preserved — restore it to keep building.</div>}

        <section className="panel-feature mt-8 rounded-3xl p-5 sm:p-8" aria-label="Where this project stands">
          <JourneyRail stages={journey} />
          {!building && (
            <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow eyebrow-pink">Continue where you left off</p>
                <p className="mt-1.5 text-lg font-semibold">
                  {next.key === 'plan' && nextStep ? `Next: ${nextStep.label}` : next.key === 'assets' ? 'Your plan is complete. Generate your first asset.' : next.key === 'kit' ? 'Keep building assets, or take your kit with you.' : `Next: ${next.label}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                {next.key === 'kit' && <a href="#assets" className="btn-secondary">Go to assets</a>}
                {next.href && <Link href={next.href} className="btn-primary">{next.cta} →</Link>}
              </div>
            </div>
          )}
        </section>

        <div className="mt-12 space-y-14">
          <StageSection id="capture" index={1} state={stateOf('capture')} label="Capture" title="Your expertise, in your words" summary="Everything below is built from these answers, and nothing else." aside={`${answered} of ${TOTAL_QUESTIONS} answered`}>
            <div className="glass rounded-2xl p-5 sm:p-6">
              <ProgressMeter value={Math.round((answered / TOTAL_QUESTIONS) * 100)} label="Knowledge interview" />
              <Link href={`/vault/${project.interview_id}`} className="link-action mt-4 inline-block text-sm">Open Knowledge Vault →</Link>
              <details className="group mt-4">
                <summary className="link-quiet cursor-pointer text-sm">View your answers</summary>
                <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
                  {INTERVIEW_QUESTIONS.map((question) => (
                    <div key={question.id} className="min-w-0 border-l border-white/10 pl-4">
                      <dt className="text-xs text-white/50">{question.question}</dt>
                      <dd className="mt-1 text-sm leading-6 text-white/80 whitespace-pre-wrap break-words">{answers[String(question.id)]?.trim() || <span className="text-white/30">Not answered</span>}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          </StageSection>

          <StageSection
            id="blueprint"
            index={2}
            state={stateOf('blueprint')}
            label="Blueprint"
            title={building ? 'Structuring what you know' : 'What HKE AI knows'}
            summary={!building && <span className="flex items-center gap-2"><span className="status-dot" aria-hidden />{knowledge.items.length} knowledge items from {knowledge.sources.map((source) => source.label.toLowerCase()).join(', ') || 'no sources yet'}.</span>}
            aside={!building && (
              <span className="flex flex-wrap gap-x-5 gap-y-1">
                <a href={`/api/projects/${project.id}/export?format=md`} className="link-quiet">Download (.md)</a>
                <a href={`/api/projects/${project.id}/export?format=html`} className="link-quiet">Printable (.html)</a>
              </span>
            )}
            last={building}
          >
            {building ? (
              <div className="notice notice-brand !rounded-2xl !p-6 !text-base">
                {interrupted ? (
                  <>
                    <p className="font-semibold">This blueprint build was interrupted before it finished.</p>
                    <p className="mt-2 text-sm text-white/60">Your interview answers are saved. Build again from the interview; the credits held by the interrupted build are returned when the new build starts.</p>
                    <div className="mt-4 flex flex-wrap gap-4">
                      <Link href={`/builder?interview=${project.interview_id}`} className="btn-primary justify-center">Build again from the interview →</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">HKE AI is extracting your knowledge into a blueprint…</p>
                    <p className="mt-2 text-sm text-white/60">This usually takes under a minute. If it has not finished after five minutes, refresh this page and you can build again from the interview.</p>
                    <div className="mt-4 flex flex-wrap gap-4">
                      <RefreshButton />
                    </div>
                  </>
                )}
              </div>
            ) : blueprint.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {blueprint.filter((entry) => entry.key !== 'elevator_pitch').map((entry) => (
                  <article key={entry.key} className="glass min-w-0 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-gold">{entry.label}</h3>
                    {typeof entry.value === 'string' ? (
                      <p className="mt-2.5 text-white/75 leading-7 whitespace-pre-wrap break-words">{entry.value}</p>
                    ) : (
                      <ul className="mt-2.5 space-y-1.5 text-white/75 leading-6">
                        {entry.value.map((item, index) => (
                          <li key={index} className="flex gap-2 break-words"><span className="text-brand-pink">•</span><span>{typeof item === 'string' ? item : <><strong className="text-white">{item.label}:</strong> {item.value}</>}</span></li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="glass rounded-2xl p-5 text-white/60">No blueprint content was saved for this project.</p>
            )}
            {!building && recommended.length > 0 && (
              <div className="surface-inset mt-4 rounded-2xl p-5">
                <h3 className="text-sm font-semibold">Recommended capabilities</h3>
                <ul className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
                  {recommended.map((capability) => (
                    <li key={capability.id}>
                      <p className="text-sm font-semibold">{capability.name} {capability.stage === 'planned' && <span className="ml-1 text-xs font-normal text-white/40">coming soon</span>}</p>
                      <p className="text-xs text-white/50 leading-5">{capability.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </StageSection>

          {!building && (
            <>
              <StageSection id="plan" index={3} state={stateOf('plan')} label="Launch plan" title="Four decisions to launch" summary="Each one sharpens what HKE AI builds for you next." aside={`${planStepsDone} of ${steps.length} decided`}>
                <ol className="grid gap-4 md:grid-cols-2">
                  {steps.map((step, index) => {
                    const done = !!step.entries?.length
                    const upNext = step.key === nextStep?.key
                    return (
                      <li key={step.key}>
                        <Link href={`/projects/${project.id}/${step.path}`} className={upNext ? 'card-link flex h-full flex-col rounded-2xl border border-brand-pink/40 bg-brand-pink/5 p-5' : 'glass card-link flex h-full flex-col rounded-2xl p-5'}>
                          <span className="flex items-center gap-3">
                            <span className={done ? 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gold text-xs font-bold text-brand-black' : upNext ? 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-pink text-xs font-bold text-brand-black' : 'grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/20 text-xs text-white/60'}>{done ? '✓' : index + 1}</span>
                            <span className="font-semibold">{step.label}</span>
                          </span>
                          {done ? (
                            <dl className="mt-4 space-y-2 text-sm">
                              {step.entries!.slice(0, 2).map((entry) => (
                                <div key={entry.label} className="min-w-0">
                                  <dt className="text-xs text-white/45">{entry.label}</dt>
                                  <dd className="line-clamp-2 text-white/75 break-words">{entry.value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="mt-4 text-sm text-white/50">{step.fields.map((field) => field.label).join(' · ')}</p>
                          )}
                          <span className={upNext ? 'link-action mt-auto pt-4 text-sm' : 'link-quiet mt-auto pt-4 text-sm'}>{done ? 'Review or change →' : upNext ? 'Decide this next →' : 'Not started →'}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </StageSection>

              <StageSection id="assets" index={4} state={stateOf('assets')} label="Assets" title="Built from your knowledge" summary="Choose what to build. Every asset can be edited, exported, and versioned." aside={`${completedAssets} ready`}>
                <AssetStudio projectId={project.id} initialAssets={assets} archived={archived} canGenerate={canGenerateAsset(usage)} buildsRemaining={usage?.builds.remaining ?? 0} hasPlan={!!usage?.active} />
                <div className="mt-4"><UsagePanel usage={usage} compact /></div>
              </StageSection>

              <StageSection id="kit" index={5} state={stateOf('kit')} label="Knowledge Kit" title="Take it with you" last>
                <KnowledgeKitPanel projectId={project.id} title={project.title} assets={assets} hasBlueprint={blueprint.length > 0} planStepsDone={planStepsDone} answered={answered} />
              </StageSection>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
