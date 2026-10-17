import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { dashboardNotice } from '@/lib/auth/messages'
import { getUserUsage } from '@/lib/hke/access'
import { assetTypeLabel, displayStatus, type AssetSummary } from '@/lib/hke/assets'
import { stepEntries } from '@/lib/hke/blueprint'
import { ASSET_SUMMARY_COLUMNS, type ProjectRow } from '@/lib/hke/db'
import { canGenerateBlueprint } from '@/lib/hke/entitlements'
import { answeredCount, parseInterviewMessages } from '@/lib/hke/interview'
import { buildJourney, currentStage, JOURNEY_KEYS, JOURNEY_LABELS } from '@/lib/hke/journey'
import { deriveLifecycle } from '@/lib/hke/lifecycle'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from '@/components/hke/AppHeader'
import ArchiveButton from '@/components/hke/ArchiveButton'
import JourneyRail from '@/components/hke/JourneyRail'
import NewProjectButton from '@/components/hke/NewProjectButton'
import RefreshButton from '@/components/hke/RefreshButton'
import UsagePanel from '@/components/hke/UsagePanel'
import { LifecycleBadge } from '@/components/hke/LifecycleBadge'

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
      return { ...interview, stage: deriveLifecycle(interview, null), answered, journey: buildJourney({ answered, interviewId: interview.id, blueprint: 'none' }) }
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
      return {
        kind: 'project' as const, id: project.id, title: project.title, stage: project.stage, journey: project.journey, updatedAt: project.updated_at,
        href: `/projects/${project.id}`,
        summary: building ? 'HKE AI is building the blueprint…' : `${project.stepsDone} of ${STEP_SECTIONS.length} plan steps · ${project.readyAssets} asset${project.readyAssets === 1 ? '' : 's'} ready`,
        next: { label: stage.cta, href: building ? `/projects/${project.id}` : stage.href ?? `/projects/${project.id}` },
      }
    }),
    ...activeDrafts.map((draft) => ({
      kind: 'interview' as const, id: draft.id, title: draft.title, stage: draft.stage, journey: draft.journey, updatedAt: draft.updated_at,
      href: `/builder?interview=${draft.id}`,
      summary: `Interview · ${draft.journey[0].detail}`,
      next: { label: draft.stage === 'knowledge_extracted' ? 'Build blueprint' : draft.answered ? 'Resume interview' : 'Start the interview', href: `/builder?interview=${draft.id}` },
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const spotlight = workspace[0] ?? null
  const others = workspace.slice(1)
  const assetsReady = activeProjects.reduce((total, project) => total + project.readyAssets, 0)
  const stats = [
    { label: 'Active projects', value: String(activeProjects.length), note: 'with a blueprint' },
    { label: 'In capture', value: String(activeDrafts.length), note: 'interviews in progress' },
    { label: 'Assets ready', value: String(assetsReady), note: 'to edit and export' },
    { label: 'Build credits', value: !usage ? '—' : usage.builds.remaining === null ? '∞' : String(usage.builds.remaining), note: usage?.active ? 'left this period' : 'no active plan' },
  ]
  const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-2">Your knowledge workspace</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome to your dashboard</h1>
            <p className="mt-2 text-white/55 break-all">{user.email}</p>
          </div>
          <div className="shrink-0">
            {hasAccess ? <NewProjectButton /> : <a href="#plans" className="btn-primary">Choose a plan to start</a>}
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
            <p className="mt-1 text-white/60">Your account is ready and nothing was charged. This is usually temporary.</p>
            <div className="mt-3"><RefreshButton label="Try again" /></div>
          </div>
        )}

        {hasAccess && !canStart && <p className="notice mb-6">You can keep interviewing, but you have no blueprint credits left this period. <a href="#plans" className="link-action">See plans</a>.</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {spotlight ? (
              <section className="panel-feature rounded-3xl p-6 sm:p-8" aria-labelledby="spotlight-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="eyebrow eyebrow-pink">Pick up where you left off</p>
                  <LifecycleBadge stage={spotlight.stage} />
                </div>
                <h2 id="spotlight-title" className="mt-3 text-2xl font-black leading-tight break-words sm:text-3xl">
                  <Link href={spotlight.href} className="hover:text-brand-pink">{spotlight.title}</Link>
                </h2>
                <p className="mt-2 text-sm text-white/55">{spotlight.summary} · Saved {when(spotlight.updatedAt)}</p>
                <JourneyRail stages={spotlight.journey} className="mt-7" />
                <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/60">Next step: <span className="font-semibold text-white">{currentStage(spotlight.journey).label}</span> — {currentStage(spotlight.journey).summary.toLowerCase()}.</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {spotlight.kind === 'project' && spotlight.next.href !== spotlight.href && <Link href={spotlight.href} className="btn-secondary">Open workspace</Link>}
                    <Link href={spotlight.next.href} className="btn-primary">{spotlight.next.label} →</Link>
                  </div>
                </div>
              </section>
            ) : (
              <section className="panel-feature rounded-3xl p-6 sm:p-8">
                <p className="eyebrow eyebrow-pink">Speak once. Build forever.</p>
                <h2 className="mt-3 text-2xl font-black sm:text-3xl">What do you know? What can HKE build from it?</h2>
                <p className="mt-3 max-w-xl text-white/60">Capture your knowledge in an interview, let HKE AI structure it into a blueprint, then build assets you can edit, export, and keep.</p>
                <JourneyRail stages={buildJourney({ answered: 0, blueprint: 'none' })} className="mt-7" />
                <div className="mt-7 border-t border-white/10 pt-6">
                  {hasAccess ? <NewProjectButton label="Start your first project" /> : <a href="#plans" className="btn-primary">Choose a plan to start</a>}
                </div>
              </section>
            )}

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="stat-tile">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-white/45">{stat.label}</dt>
                  <dd className="stat-value mt-3">{stat.value}</dd>
                  <dd className="mt-1.5 text-xs text-white/40">{stat.note}</dd>
                </div>
              ))}
            </dl>

            <section aria-labelledby="workspace-title">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Capture · Blueprint · Build</p>
                  <h2 id="workspace-title" className="mt-1 text-2xl font-bold">Your projects</h2>
                </div>
                <p className="text-sm text-white/45">{workspace.length} in progress</p>
              </div>
              {others.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {others.map((item) => (
                    <article key={item.id} className="glass card-link flex flex-col rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-lg font-semibold leading-snug break-words"><Link href={item.href} className="hover:text-brand-pink">{item.title}</Link></h3>
                        <LifecycleBadge stage={item.stage} />
                      </div>
                      <p className="mt-1.5 text-sm text-white/50">{item.summary}</p>
                      <JourneyRail stages={item.journey} compact className="mt-5" />
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <Link href={item.next.href} className="link-action text-sm">{item.next.label} →</Link>
                        <span className="flex items-center gap-4">
                          <span className="text-xs text-white/40">{new Date(item.updatedAt).toLocaleDateString()}</span>
                          {item.kind === 'interview' && <ArchiveButton kind="interview" id={item.id} archived={false} />}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="glass rounded-2xl p-5 text-white/60">{loadFailed ? 'Your projects could not be loaded. See the message above.' : spotlight ? 'This is your only project so far. Start another whenever you have more to capture.' : 'No saved projects yet. Finish an interview and build your blueprint to see it here.'}</p>
              )}
            </section>

            {recentAssets.length > 0 && (
              <section aria-labelledby="assets-title">
                <p className="eyebrow">Review · built from your knowledge</p>
                <h2 id="assets-title" className="mb-4 mt-1 text-2xl font-bold">Recent Assets</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {recentAssets.map((asset) => (
                    <li key={asset.id}>
                      <Link href={`/projects/${asset.project_id}/assets/${asset.id}`} className="surface-inset card-link flex h-full items-start gap-4 rounded-xl p-4">
                        <span className="paper grid h-14 w-11 shrink-0 place-items-center text-[9px] font-black" aria-hidden>HKE</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-brand-gold">{assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` · v${asset.version}` : ''}</span>
                          <span className="mt-1 block font-semibold leading-snug break-words">{asset.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-white/45"><span className="status-dot" aria-hidden />{asset.projectTitle}{displayStatus(asset) === 'completed' ? ` · ${new Date(asset.updated_at).toLocaleDateString()}` : ''}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {archived.length > 0 && (
              <details className="glass rounded-2xl p-5">
                <summary className="cursor-pointer font-semibold text-white/70">Archived ({archived.length})</summary>
                <ul className="mt-4 space-y-2">
                  {archived.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <Link href={item.href} className="truncate text-white/70 hover:text-white">{item.title}</Link>
                      <ArchiveButton kind={item.kind} id={item.id} archived />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <UsagePanel usage={usage} />
            <section className="glass rounded-2xl p-6">
              <h2 className="font-semibold">How HKE AI works</h2>
              <ol className="mt-4 space-y-4" aria-label="How HKE works">
                {JOURNEY_KEYS.map((key, index) => (
                  <li key={key} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-[11px] font-bold text-status">{index + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold">{JOURNEY_LABELS[key].label}</span>
                      <span className="block text-xs leading-5 text-white/50">{JOURNEY_LABELS[key].summary}</span>
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
