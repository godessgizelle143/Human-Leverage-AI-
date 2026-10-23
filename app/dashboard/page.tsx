import Link from 'next/link'
import clsx from 'clsx'
import { Brain, Check } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { dashboardNotice } from '@/lib/auth/messages'
import { getUserUsage } from '@/lib/hke/access'
import { assetTypeLabel, displayStatus, type AssetSummary } from '@/lib/hke/assets'
import { stepEntries } from '@/lib/hke/blueprint'
import { ASSET_SUMMARY_COLUMNS, type ProjectRow } from '@/lib/hke/db'
import { canGenerateBlueprint } from '@/lib/hke/entitlements'
import { answeredCount, parseInterviewMessages, TOTAL_QUESTIONS } from '@/lib/hke/interview'
import { crownFor } from '@/lib/hke/jewels'
import { buildJourney, currentStage, JOURNEY_KEYS, JOURNEY_LABELS } from '@/lib/hke/journey'
import { deriveLifecycle } from '@/lib/hke/lifecycle'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from '@/components/hke/AppHeader'
import ArchiveButton from '@/components/hke/ArchiveButton'
import CrownCard from '@/components/hke/CrownCard'
import NewProjectButton from '@/components/hke/NewProjectButton'
import RefreshButton from '@/components/hke/RefreshButton'
import UsagePanel from '@/components/hke/UsagePanel'
import { LifecycleBadge } from '@/components/hke/LifecycleBadge'
import RefreshOnReturn from '@/components/hke/RefreshOnReturn'

export const dynamic = 'force-dynamic'

type ProjectListRow = Pick<ProjectRow, 'id' | 'title' | 'status' | 'interview_id' | 'content' | 'archived_at' | 'created_at' | 'updated_at'>

export default async function DashboardPage({ searchParams }: { searchParams: { checkout?: string | string[]; error?: string | string[] } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  let access = await getUserUsage(supabase, user)

  // New authenticated users receive the cardless trial through the database RPC.
  // This keeps trial creation behind auth.uid() and avoids a direct subscriptions INSERT.
  let trialFailed = false
  if (!access.subscription) {
    const { error: trialError } = await supabase.rpc('start_trial')
    if (trialError) console.error('CARDLESS TRIAL CREATION ERROR:', trialError.message)
    else access = await getUserUsage(supabase, user)
    trialFailed = !access.subscription && !access.isOwner
  }
  const { isOwner, subscription, usage } = access
  const notice = dashboardNotice(searchParams)
  const hasAccess = !!usage?.active
  const canStart = canGenerateBlueprint(usage)

  const [{ data: projectRows, error: projectsError }, { data: interviewRows, error: interviewsError }, { data: assetRows, error: assetsError }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, status, interview_id, content, archived_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('interviews')
      .select('id, title, status, progress, messages, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('project_assets')
      .select(ASSET_SUMMARY_COLUMNS)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  // A failed read must not look like an empty workspace.
  const loadFailed = !!(projectsError || interviewsError || assetsError)
  if (loadFailed) console.error('Dashboard load failed:', (projectsError ?? interviewsError ?? assetsError)?.message)

  const assetsByProject = new Map<string, AssetSummary[]>()
  for (const asset of (assetRows ?? []) as AssetSummary[]) assetsByProject.set(asset.project_id, [...(assetsByProject.get(asset.project_id) ?? []), asset])

  const interviews = interviewRows ?? []
  const interviewsById = new Map(interviews.map((interview) => [interview.id, interview]))
  const projects = ((projectRows ?? []) as ProjectListRow[]).map((project) => {
    const assets = assetsByProject.get(project.id) ?? []
    const stage = deriveLifecycle(interviewsById.get(project.interview_id), project, assets)
    const stepsDone = STEP_SECTIONS.filter((step) => stepEntries(project.content, step.key)?.length).length
    const readyAssets = assets.filter((asset) => asset.status === 'completed').length
    const journey = buildJourney({
      answered: answeredCount(parseInterviewMessages(interviewsById.get(project.interview_id)?.messages).answers),
      projectId: project.id,
      blueprint: project.status === 'completed' ? 'ready' : 'building',
      stepsDone,
      nextStepPath: STEP_SECTIONS.find((step) => !stepEntries(project.content, step.key)?.length)?.path,
      assetsReady: readyAssets,
    })
    return { ...project, stage, assets, stepsDone, readyAssets, journey }
  })
  const interviewsWithProject = new Set(projects.map((project) => project.interview_id))
  const drafts = interviews
    .filter((interview) => !interviewsWithProject.has(interview.id))
    .map((interview) => {
      const state = parseInterviewMessages(interview.messages)
      const answered = answeredCount(state.answers)
      return { ...interview, stage: deriveLifecycle(interview, null), answered, journey: buildJourney({ answered, interviewId: interview.id, blueprint: 'none', interviewDone: interview.status === 'completed' }) }
    })

  const activeDrafts = drafts.filter((draft) => draft.stage !== 'archived')
  const activeProjects = projects.filter((project) => project.stage !== 'archived')
  const archived = [
    ...projects.filter((project) => project.stage === 'archived').map((project) => ({ kind: 'project' as const, id: project.id, title: project.title, href: `/projects/${project.id}` })),
    ...drafts.filter((draft) => draft.stage === 'archived').map((draft) => ({ kind: 'interview' as const, id: draft.id, title: draft.title, href: `/builder?interview=${draft.id}` })),
  ]
  const recentAssets = activeProjects
    .flatMap((project) => project.assets.filter((asset) => asset.status === 'completed').map((asset) => ({ ...asset, projectTitle: project.title })))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6)
  const trialEnded = !!usage && !usage.active

  // One list of everything in progress, newest first. A project's next action
  // is its current journey stage; a draft's is its interview (or the build).
  const workspace = [
    ...activeProjects.map((project) => {
      const stage = currentStage(project.journey)
      const building = project.status !== 'completed'
      const stagesDone = project.journey.filter((item) => item.state === 'done').length
      return {
        kind: 'project' as const, id: project.id, title: project.title, stage: project.stage, journey: project.journey, updatedAt: project.updated_at,
        href: `/projects/${project.id}`,
        vaultHref: `/vault/${project.interview_id}`,
        summary: building ? 'HKE is building the blueprint…' : `${project.stepsDone} of ${STEP_SECTIONS.length} plan steps · ${project.readyAssets} asset${project.readyAssets === 1 ? '' : 's'} ready`,
        nextLine: building ? 'HKE is building your blueprint from your answers.' : `Next up: ${stage.label.toLowerCase()} — ${stage.summary.toLowerCase()}.`,
        progress: Math.round((stagesDone / project.journey.length) * 100),
        next: { label: stage.cta, href: building ? `/projects/${project.id}` : stage.href ?? `/projects/${project.id}` },
      }
    }),
    ...activeDrafts.map((draft) => ({
      kind: 'interview' as const, id: draft.id, title: draft.title, stage: draft.stage, journey: draft.journey, updatedAt: draft.updated_at,
      href: `/builder?interview=${draft.id}`,
      vaultHref: `/vault/${draft.id}`,
      summary: `Interview · ${draft.journey[0].detail}`,
      nextLine: draft.answered
        ? `You've answered ${draft.answered} of ${TOTAL_QUESTIONS} questions.${draft.stage === 'knowledge_extracted' ? ' Your answers are ready to become a blueprint.' : ''}`
        : 'No answers yet. Start whenever you are ready.',
      progress: Math.round((draft.answered / TOTAL_QUESTIONS) * 100),
      next: { label: draft.stage === 'knowledge_extracted' ? 'Build my blueprint' : draft.answered ? 'Resume interview' : 'Start the interview', href: `/builder?interview=${draft.id}` },
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const spotlight = workspace[0] ?? null
  const path = spotlight?.journey ?? buildJourney({ answered: 0, blueprint: 'none' })
  const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  const firstName = fullName.split(/\s+/)[0]
  const daysLeft = usage?.periodEnd ? Math.max(0, Math.ceil((new Date(usage.periodEnd).getTime() - Date.now()) / 86_400_000)) : null
  const planChip = !usage?.active
    ? null
    : usage.plan === 'owner'
      ? 'Owner access'
      : usage.trialing && daysLeft !== null
        ? `${usage.planLabel} trial · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
        : `${usage.planLabel} plan`

  return (
    <main className="min-h-screen bg-brand-black text-brand-text">
      <RefreshOnReturn renderId={crypto.randomUUID()} />
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="font-script text-3xl text-brand-pink sm:text-4xl">Speak once. Build forever.</p>
            <h1 className="dash-title mt-2 break-words text-3xl sm:text-5xl">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-brand-body">Pick up where you left off, or start a new interview. Answer in your own words. HKE turns your answers into finished writing.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            {planChip && <span className="chip-plan self-start sm:self-auto">{planChip}</span>}
            {hasAccess ? <NewProjectButton variant="gold" label="+ Start a new interview" /> : <a href="#plans" className="btn-gold">Choose a plan to start</a>}
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={
              notice.tone === 'success'
                ? 'notice notice-success mb-6'
                : notice.tone === 'error'
                  ? 'notice notice-error mb-6'
                  : 'notice mb-6'
            }
          >
            {notice.message}
          </div>
        )}

        {loadFailed && (
          <div role="alert" className="notice notice-error mb-6">
            <p className="font-semibold">Some of your saved work could not be loaded.</p>
            <p className="mt-1">Nothing was changed or deleted, but the lists below may be incomplete.</p>
            <div className="mt-3"><RefreshButton label="Try again" /></div>
          </div>
        )}

        {trialFailed && (
          <div role="alert" className="notice notice-brand mb-6">
            <p className="font-semibold">We couldn&apos;t activate your free trial yet.</p>
            <p className="mt-1 text-brand-muted">Your account is ready and nothing was charged. This is usually temporary.</p>
            <div className="mt-3"><RefreshButton label="Try again" /></div>
          </div>
        )}

        {hasAccess && !canStart && <p className="notice mb-6">You can keep interviewing, but you have no blueprint credits left this period. <a href="#plans" className="link-action">See plans</a>.</p>}

        <section aria-labelledby="path-title" className="mb-10">
          <h2 id="path-title" className="dash-section-title mb-5">Your path</h2>
          <ol className="grid gap-3 md:grid-cols-5 md:gap-4">
            {path.map((stage, index) => {
              const body = (
                <>
                  <span className={clsx('path-dot', stage.state === 'done' && 'path-dot-done', stage.state === 'current' && 'path-dot-current')} aria-hidden>
                    {stage.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-brand-text">{stage.label}</span>
                    <span className="mt-1 block text-sm text-brand-muted">{stage.state === 'done' ? 'Done' : stage.state === 'current' ? stage.detail : 'Up next'}</span>
                  </span>
                </>
              )
              const className = clsx('path-step items-center gap-4 md:flex-col md:items-start md:gap-3', stage.state === 'current' && 'path-step-current')
              return (
                <li key={stage.key} aria-current={stage.state === 'current' ? 'step' : undefined}>
                  {stage.href ? <Link href={stage.href} className={className}>{body}</Link> : <div className={className}>{body}</div>}
                </li>
              )
            })}
          </ol>
        </section>

        <CrownCard crown={crownFor(path)} className="mb-10" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            {spotlight ? (
              <section className="dash-card p-6 sm:p-8" aria-labelledby="spotlight-title">
                <p className="eyebrow eyebrow-pink">Continue where you left off</p>
                <h2 id="spotlight-title" className="dash-title mt-4 break-words text-2xl sm:text-3xl">
                  <Link href={spotlight.href} className="hover:text-brand-goldPale">{spotlight.title}</Link>
                </h2>
                <p className="mt-4 text-lg text-brand-body">{spotlight.nextLine}</p>
                <p className="mt-1 text-sm text-brand-faint">{spotlight.summary} · Saved {when(spotlight.updatedAt)}</p>
                <div className="dash-progress mt-6" role="progressbar" aria-label="How far along this is" aria-valuemin={0} aria-valuemax={100} aria-valuenow={spotlight.progress}>
                  <div className="dash-progress-fill" style={{ width: `${spotlight.progress}%` }} />
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link href={spotlight.next.href} className="btn-gold">{spotlight.next.label}</Link>
                  <Link href={spotlight.vaultHref} className="btn-gold-outline">See my answers</Link>
                  {spotlight.kind === 'project' && spotlight.next.href !== spotlight.href && <Link href={spotlight.href} className="link-gold text-sm sm:ml-2">Open project</Link>}
                </div>
              </section>
            ) : (
              <section className="dash-card p-6 sm:p-8">
                <p className="eyebrow eyebrow-pink">Your first interview</p>
                <h2 className="dash-title mt-4 text-2xl sm:text-3xl">What do you know? What can HKE build from it?</h2>
                <p className="mt-4 max-w-xl text-brand-body">Answer a few questions about your business in your own words. HKE turns them into a blueprint, then builds things you can edit, export, and keep.</p>
                <div className="mt-6">
                  {hasAccess ? <NewProjectButton variant="gold" label="Start your first interview" /> : <a href="#plans" className="btn-gold">Choose a plan to start</a>}
                </div>
              </section>
            )}

            <section aria-labelledby="workspace-title">
              <h2 id="workspace-title" className="dash-section-title mb-5">Your interviews</h2>
              {workspace.length > 0 ? (
                <ul className="dash-card divide-y divide-brand-lineSoft overflow-hidden">
                  {workspace.map((item) => (
                    <li key={item.id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-brand-text"><Link href={item.href} className="hover:text-brand-goldPale">{item.title}</Link></h3>
                        <p className="mt-1 text-sm text-brand-muted">Last saved {new Date(item.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-4">
                        <LifecycleBadge stage={item.stage} />
                        <Link href={item.href} className="link-gold text-sm">Open</Link>
                        {item.kind === 'interview' && <ArchiveButton kind="interview" id={item.id} archived={false} />}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dash-card p-5 text-brand-body">{loadFailed ? 'Your interviews could not be loaded. See the message above.' : 'No saved interviews yet. Start one and it will show up here.'}</p>
              )}
            </section>

            {recentAssets.length > 0 && (
              <section aria-labelledby="assets-title">
                <h2 id="assets-title" className="dash-section-title mb-5">Recent assets</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {recentAssets.map((asset) => (
                    <li key={asset.id}>
                      <Link href={`/projects/${asset.project_id}/assets/${asset.id}`} className="dash-card card-link flex h-full items-start gap-4 p-4">
                        <span className="paper grid h-14 w-11 shrink-0 place-items-center text-[9px] font-black" aria-hidden>HKE</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-brand-goldSoft">{assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` · v${asset.version}` : ''}</span>
                          <span className="mt-1 block break-words font-semibold leading-snug text-brand-text">{asset.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted"><span className="status-dot" aria-hidden />{asset.projectTitle}{displayStatus(asset) === 'completed' ? ` · ${new Date(asset.updated_at).toLocaleDateString()}` : ''}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {archived.length > 0 && (
              <details className="dash-card p-5">
                <summary className="cursor-pointer font-semibold text-brand-muted">Archived ({archived.length})</summary>
                <ul className="mt-4 space-y-2">
                  {archived.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <Link href={item.href} className="truncate text-brand-body hover:text-brand-text">{item.title}</Link>
                      <ArchiveButton kind={item.kind} id={item.id} archived />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {spotlight && (
              <section className="dash-card p-6" aria-labelledby="vault-title">
                <h2 id="vault-title" className="dash-title flex items-center gap-3 text-xl"><Brain className="h-6 w-6 text-brand-gold" aria-hidden />Knowledge Vault</h2>
                <p className="mt-3 text-brand-body">Everything you&apos;ve shared, saved in one place.</p>
                <Link href={spotlight.vaultHref} className="link-gold mt-4 inline-block">Open my Vault</Link>
              </section>
            )}
            <UsagePanel usage={usage} />
            <section className="dash-card p-6" aria-labelledby="help-title">
              <h2 id="help-title" className="dash-title text-xl">Need a hand?</h2>
              <p className="mt-3 text-brand-body">No wrong answers here. Write however feels natural.</p>
              <h3 className="mt-5 text-sm font-semibold text-brand-goldSoft">How HKE works</h3>
              <ol className="mt-3 space-y-4" aria-label="How HKE works">
                {JOURNEY_KEYS.map((key, index) => (
                  <li key={key} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand-line text-[11px] font-bold text-brand-goldSoft">{index + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold text-brand-text">{JOURNEY_LABELS[key].label}</span>
                      <span className="block text-xs leading-5 text-brand-muted">{JOURNEY_LABELS[key].summary}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>

        <section id="plans" className="mt-14 scroll-mt-24" aria-labelledby="plans-title">
          <p className="eyebrow">Plans</p>
          <h2 id="plans-title" className="mb-5 mt-1 text-2xl font-bold">Build more from what you know</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.entries(PRICING_PLANS) as [PlanKey, typeof PRICING_PLANS[PlanKey]][]).map(([key, plan]) => (
              <div key={key} className={`rounded-2xl p-6 ${key === 'professional' ? 'panel-feature' : 'glass'}`}>
                {key === 'professional' && <div className="eyebrow mb-2">Most Popular</div>}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="my-5"><span className="text-4xl font-bold gradient-text">${plan.price / 100}</span><span className="text-white/40">/month</span></div>
                <ul className="space-y-2 mb-7 text-sm text-white/70">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-brand-gold" aria-hidden>✓</span>{feature}</li>)}</ul>
                <form action="/api/checkout" method="POST"><input type="hidden" name="plan" value={key} /><button type="submit" disabled={isOwner || (subscription?.plan === key && !trialEnded)} className={key === 'professional' ? 'btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed' : 'btn-secondary w-full disabled:opacity-60 disabled:cursor-not-allowed'}>{isOwner ? 'Owner Test Access' : subscription?.plan === key && !trialEnded ? 'Current Plan' : 'Choose Plan'}</button></form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
