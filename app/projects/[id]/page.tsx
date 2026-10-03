import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ProjectAssets from '@/components/hke/ProjectAssets'
import {
  HKE_BLUEPRINT_FIELDS,
  HKE_INTERNAL_CONTENT_KEYS,
  HKE_STEP_SECTIONS,
  asRecord,
  asText,
  type HKEAsset,
} from '@/lib/hke/assets'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('project_assets')
    .select('id, project_id, asset_type, title, content, status, version, created_at, updated_at')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const content = asRecord(project.content)

  const blueprint = Object.entries(HKE_BLUEPRINT_FIELDS)
    .map(([key, label]) => ({ key, label, value: asText(content[key]) }))
    .filter((section) => section.value)

  // Blueprint keys from older generations that the field list does not know about yet.
  const knownKeys = new Set<string>([...Object.keys(HKE_BLUEPRINT_FIELDS), ...Object.keys(HKE_STEP_SECTIONS), ...HKE_INTERNAL_CONTENT_KEYS])
  const otherSections = Object.entries(content)
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), value: asText(value) }))
    .filter((section) => section.value)

  const savedSteps = (Object.keys(HKE_STEP_SECTIONS) as (keyof typeof HKE_STEP_SECTIONS)[]).map((key) => {
    const saved = asRecord(content[key])
    const fields = Object.entries(HKE_STEP_SECTIONS[key].fields)
      .map(([field, label]) => ({ field, label, value: asText(saved[field]) }))
      .filter((entry) => entry.value)
    return { key, label: HKE_STEP_SECTIONS[key].label, fields }
  })
  const isStepSaved = (key: keyof typeof HKE_STEP_SECTIONS) => savedSteps.some((step) => step.key === key && step.fields.length > 0)

  const recommendedModules = Array.isArray(content.recommended_modules)
    ? content.recommended_modules.filter((module): module is string => typeof module === 'string')
    : []

  const moduleSteps: Record<string, { title: string; description: string }> = {
    'app-builder': {
      title: 'Build your customer-facing foundation',
      description: 'Turn the blueprint into the website, booking flow, or application your customers will use.',
    },
    'content-strategy': {
      title: 'Create your launch content plan',
      description: 'Turn your positioning into a practical 30/60/90-day content plan for reaching your first customers.',
    },
    'social-media-manager': {
      title: 'Start your social launch',
      description: 'Create the social presence and launch activity that puts your offer in front of the right audience.',
    },
    'email-outreach': {
      title: 'Build your first outreach sequence',
      description: 'Create a focused outreach sequence for prospective customers, partners, or local relationships.',
    },
    'performance-report': {
      title: 'Measure what happens next',
      description: 'Track your early results so you can see what is working and decide what to improve.',
    },
  }

  const nextMoves = [
    {
      title: 'Define your launch target',
      description: 'Choose the specific audience, location, offer, and first milestone you are launching toward.',
    },
    {
      title: 'Turn the offer into something customers can act on',
      description: 'Make the service, product, pricing, and next action clear enough that someone can buy, book, or contact you.',
    },
    ...recommendedModules
      .map((module) => moduleSteps[module] ? { ...moduleSteps[module], module } : null)
      .filter((move): move is { title: string; description: string; module: string } => Boolean(move))
      .slice(0, 3),
  ].map((move, index) => ({ ...move, number: index + 1 }))

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-brand-gold text-sm font-semibold mb-2">HKE AI · HUMAN KNOWLEDGE ENGINE</p>
            <h1 className="text-3xl font-bold">{project.title}</h1>
          </div>
          <Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <p className="text-brand-gold font-semibold">Your knowledge is captured</p>
            <h2 className="text-2xl font-semibold mt-2">Your business blueprint</h2>
            <p className="text-white/60 mt-2 leading-7">
              HKE organized your interview into the blueprint below. Complete Steps 01–04 to sharpen it, then build assets from everything you have saved.
            </p>
          </div>

          <section className="mb-10 rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-6">
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-wide">What happens next</p>
            <h3 className="text-2xl font-semibold mt-1">Your next moves</h3>
            <p className="text-white/60 mt-2 mb-5">Use your blueprint as the starting point. Complete these moves in order.</p>
            <div className="space-y-4">
              {nextMoves.map((move) => (
                <div key={move.number} className="flex gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-gold/50 text-brand-gold font-semibold">
                    {move.number}
                  </div>
                  <div>
                    <h4 className="font-semibold">{move.title}</h4>
                    <p className="text-white/70 leading-6 mt-1">{move.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mb-10 rounded-2xl border border-brand-gold/30 bg-white/5 p-6">
            <p className="text-brand-gold font-semibold">What happens next</p>
            <h3 className="text-xl font-semibold mt-2">Turn your blueprint into action</h3>
            <p className="text-white/70 mt-2 leading-7">
              Choose the next step you want to build from this blueprint.
            </p>

            <div className="grid gap-4 md:grid-cols-2 mt-6">
              <Link
                href={`/projects/${params.id}/launch-target`}
                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
              >
                <span className="flex items-center justify-between"><span className="text-brand-gold font-semibold">01</span>{isStepSaved('launch_target') && <span className="text-xs font-semibold text-brand-pink">Saved ✓</span>}</span>
                <h4 className="text-lg font-semibold mt-2">Define your launch target</h4>
                <p className="text-white/60 text-sm mt-1">
                  Clarify your audience, service area, offer, and first milestone.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/customer-offer`}
                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
              >
                <span className="flex items-center justify-between"><span className="text-brand-gold font-semibold">02</span>{isStepSaved('customer_offer') && <span className="text-xs font-semibold text-brand-pink">Saved ✓</span>}</span>
                <h4 className="text-lg font-semibold mt-2">Build your customer offer</h4>
                <p className="text-white/60 text-sm mt-1">
                  Turn the idea into a clear service, pricing structure, and customer action.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/customer-foundation`}
                className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 hover:bg-brand-gold/10 transition"
              >
                <span className="flex items-center justify-between"><span className="text-brand-gold font-semibold">03</span>{isStepSaved('customer_foundation') && <span className="text-xs font-semibold text-brand-pink">Saved ✓</span>}</span>
                <h4 className="text-lg font-semibold mt-2">Build your customer foundation</h4>
                <p className="text-white/60 text-sm mt-1">
                  Create the website, booking flow, or application customers will use.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/launch-content`}
                className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 hover:bg-brand-gold/10 transition"
              >
                <span className="flex items-center justify-between"><span className="text-brand-gold font-semibold">04</span>{isStepSaved('launch_content') && <span className="text-xs font-semibold text-brand-pink">Saved ✓</span>}</span>
                <h4 className="text-lg font-semibold mt-2">Create your launch content</h4>
                <p className="text-white/60 text-sm mt-1">
                  Build a practical 30/60/90-day plan from your positioning.
                </p>
              </Link>
            </div>
          </div>

          <ProjectAssets projectId={project.id} initialAssets={(assets ?? []) as HKEAsset[]} />

          <div className="space-y-7">
            {[...blueprint, ...otherSections].map((section) => (
              <section key={section.key}>
                <h3 className="text-lg font-semibold capitalize mb-2">{section.label}</h3>
                <p className="text-white/80 leading-7 whitespace-pre-wrap">{section.value}</p>
              </section>
            ))}
          </div>

          {savedSteps.some((step) => step.fields.length > 0) && (
            <div className="mt-10 border-t border-white/10 pt-8">
              <p className="text-brand-gold font-semibold">Your saved steps</p>
              <div className="mt-4 space-y-6">
                {savedSteps.filter((step) => step.fields.length > 0).map((step) => (
                  <section key={step.key}>
                    <h3 className="text-lg font-semibold mb-2">{step.label}</h3>
                    <dl className="space-y-2">
                      {step.fields.map((entry) => (
                        <div key={entry.field}>
                          <dt className="text-white/50 text-sm">{entry.label}</dt>
                          <dd className="text-white/80 leading-7 whitespace-pre-wrap">{entry.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
