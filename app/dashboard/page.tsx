import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { getUserUsage } from '@/lib/hke/access'
import { assetTypeLabel, displayStatus, type AssetSummary } from '@/lib/hke/assets'
import { stepEntries } from '@/lib/hke/blueprint'
import { ASSET_SUMMARY_COLUMNS, type ProjectRow } from '@/lib/hke/db'
import { canGenerateBlueprint } from '@/lib/hke/entitlements'
import { answeredCount, parseInterviewMessages, TOTAL_QUESTIONS } from '@/lib/hke/interview'
import { deriveLifecycle, lifecycleStep } from '@/lib/hke/lifecycle'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import AppHeader from '@/components/hke/AppHeader'
import ArchiveButton from '@/components/hke/ArchiveButton'
import NewProjectButton from '@/components/hke/NewProjectButton'
import UsagePanel from '@/components/hke/UsagePanel'
import { LifecycleBadge, ProgressMeter } from '@/components/hke/LifecycleBadge'

export const dynamic = 'force-dynamic'

type ProjectListRow = Pick<ProjectRow, 'id' | 'title' | 'status' | 'interview_id' | 'content' | 'archived_at' | 'created_at' | 'updated_at'>

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  let access = await getUserUsage(supabase, user)

  // New authenticated users receive the cardless trial through the database RPC.
  // This keeps trial creation behind auth.uid() and avoids a direct subscriptions INSERT.
  if (!access.subscription) {
    const { error: trialError } = await supabase.rpc('start_trial')
    if (!trialError) access = await getUserUsage(supabase, user)
  }
  const { isOwner, subscription, usage } = access
  const hasAccess = !!usage?.active
  const canStart = canGenerateBlueprint(usage)

  const [{ data: projectRows }, { data: interviewRows }, { data: assetRows }] = await Promise.all([
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

  const assetsByProject = new Map<string, AssetSummary[]>()
  for (const asset of (assetRows ?? []) as AssetSummary[]) assetsByProject.set(asset.project_id, [...(assetsByProject.get(asset.project_id) ?? []), asset])

  const interviews = interviewRows ?? []
  const interviewsById = new Map(interviews.map((interview) => [interview.id, interview]))
  const projects = ((projectRows ?? []) as ProjectListRow[]).map((project) => {
    const assets = assetsByProject.get(project.id) ?? []
    const stage = deriveLifecycle(interviewsById.get(project.interview_id), project, assets)
    const stepsDone = STEP_SECTIONS.filter((step) => stepEntries(project.content, step.key)?.length).length
    return { ...project, stage, assets, stepsDone }
  })
  const interviewsWithProject = new Set(projects.map((project) => project.interview_id))
  const drafts = interviews
    .filter((interview) => !interviewsWithProject.has(interview.id))
    .map((interview) => {
      const state = parseInterviewMessages(interview.messages)
      return { ...interview, stage: deriveLifecycle(interview, null), answered: answeredCount(state.answers) }
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
  const continueItem = activeDrafts[0] ?? null
  const trialEnded = !!usage && !usage.active

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-brand-gold text-sm font-semibold mb-2">HKE AI</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Welcome to your dashboard</h1>
          <p className="text-white/60 break-all">{user.email}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] mb-10">
          <section className="relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 via-white/[.02] to-brand-pink/10 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-pink">Speak once. Build forever.</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black">What do you know? What can HKE build from it?</h2>
            <p className="mt-3 max-w-xl text-white/60">Capture your knowledge in an interview, let HKE AI structure it into a blueprint, then build assets you can edit, export, and keep.</p>
            <ol className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-white/50" aria-label="How HKE works">
              {['Capture', 'Understand', 'Build', 'Review', 'Deploy'].map((step, index) => (
                <li key={step} className="rounded-full border border-white/10 px-3 py-1"><span className="text-brand-gold">{index + 1}</span> {step}</li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
              {hasAccess ? <NewProjectButton /> : <a href="#plans" className="btn-primary justify-center">Choose a plan to start</a>}
              {continueItem && (
                <Link href={`/builder?interview=${continueItem.id}`} className="btn-secondary justify-center">
                  Continue “{continueItem.title}”
                </Link>
              )}
            </div>
            {hasAccess && !canStart && <p className="mt-3 text-sm text-white/60">You can keep interviewing, but you have no blueprint credits left this period. <a href="#plans" className="text-brand-gold hover:underline">See plans</a>.</p>}
          </section>

          <UsagePanel usage={usage} />
        </div>

        {activeDrafts.length > 0 && (
          <section className="mb-10">
            <p className="text-brand-gold text-sm font-semibold">CAPTURE · IN PROGRESS</p>
            <h2 className="text-2xl font-bold mb-4">Continue Existing Work</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeDrafts.map((draft) => (
                <article key={draft.id} className="glass rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug break-words min-w-0">{draft.title}</h3>
                    <LifecycleBadge stage={draft.stage} />
                  </div>
                  <div className="mt-4"><ProgressMeter value={Math.round((draft.answered / TOTAL_QUESTIONS) * 100)} label={`${draft.answered} of ${TOTAL_QUESTIONS} answered`} /></div>
                  <p className="mt-3 text-xs text-white/40">Saved {new Date(draft.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <Link href={`/builder?interview=${draft.id}`} className="text-sm font-semibold text-brand-gold hover:underline">
                      {draft.stage === 'knowledge_extracted' ? 'Build blueprint →' : 'Resume interview →'}
                    </Link>
                    <ArchiveButton kind="interview" id={draft.id} archived={false} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <p className="text-brand-gold text-sm font-semibold">UNDERSTAND · BUILD</p>
          <h2 className="text-2xl font-bold mb-4">Saved Projects</h2>
          {activeProjects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map((project) => {
                const readyAssets = project.assets.filter((asset) => asset.status === 'completed').length
                const building = project.status !== 'completed'
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="glass rounded-2xl p-5 transition-colors hover:border-brand-gold/40 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-snug break-words min-w-0">{project.title}</h3>
                      <LifecycleBadge stage={project.stage} />
                    </div>
                    <div className="mt-4"><ProgressMeter value={Math.round((lifecycleStep(project.stage) / 5) * 100)} /></div>
                    <p className="mt-3 text-sm text-white/55">{building ? 'Building blueprint…' : `${project.stepsDone} of ${STEP_SECTIONS.length} plan steps · ${readyAssets} asset${readyAssets === 1 ? '' : 's'}`}</p>
                    <p className="mt-1 text-xs text-white/40">Updated {new Date(project.updated_at).toLocaleDateString()}</p>
                    <p className="mt-auto pt-4 text-sm font-semibold text-brand-gold">Open workspace →</p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="glass rounded-2xl p-5 text-white/60">No saved projects yet. Finish an interview and build your blueprint to see it here.</p>
          )}
        </section>

        {recentAssets.length > 0 && (
          <section className="mb-10">
            <p className="text-brand-pink text-sm font-semibold">REVIEW · BUILT FROM YOUR KNOWLEDGE</p>
            <h2 className="text-2xl font-bold mb-4">Recent Assets</h2>
            <ul className="glass rounded-2xl divide-y divide-white/10">
              {recentAssets.map((asset) => (
                <li key={asset.id}>
                  <Link href={`/projects/${asset.project_id}/assets/${asset.id}`} className="flex flex-col gap-1 p-4 transition hover:bg-white/[.03] sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{asset.title}</span>
                      <span className="block text-xs text-white/50 truncate">{assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` · v${asset.version}` : ''} · {asset.projectTitle}</span>
                    </span>
                    <span className="text-xs text-white/40 shrink-0">{displayStatus(asset) === 'completed' ? new Date(asset.updated_at).toLocaleDateString() : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {archived.length > 0 && (
          <details className="mb-10 glass rounded-2xl p-5">
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

        <div id="plans" className="grid md:grid-cols-3 gap-6 scroll-mt-24">
          {(Object.entries(PRICING_PLANS) as [PlanKey, typeof PRICING_PLANS[PlanKey]][]).map(([key, plan]) => (
            <div key={key} className={`rounded-2xl p-6 ${key === 'professional' ? 'bg-gradient-to-b from-brand-gold/10 to-brand-pink/10 border border-brand-gold/30' : 'glass'}`}>
              {key === 'professional' && <div className="text-brand-gold text-sm font-semibold mb-2">Most Popular</div>}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <div className="my-5"><span className="text-4xl font-bold gradient-text">${plan.price / 100}</span><span className="text-white/40">/month</span></div>
              <ul className="space-y-2 mb-7 text-sm text-white/70">{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              <form action="/api/checkout" method="POST"><input type="hidden" name="plan" value={key} /><button type="submit" disabled={isOwner || (subscription?.plan === key && !trialEnded)} className={key === 'professional' ? 'btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed' : 'btn-secondary w-full disabled:opacity-60 disabled:cursor-not-allowed'}>{isOwner ? 'Owner Test Access' : subscription?.plan === key && !trialEnded ? 'Current Plan' : 'Choose Plan'}</button></form>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
