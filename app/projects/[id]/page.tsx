import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

  const content = project.content as Record<string, unknown>

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
            <p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p>
            <h1 className="text-3xl font-bold">{project.title}</h1>
          </div>
          <Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <p className="text-brand-gold font-semibold">Your assets are ready</p>
            <h2 className="text-2xl font-semibold mt-2">Your business blueprint</h2>
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
                <span className="text-brand-gold font-semibold">01</span>
                <h4 className="text-lg font-semibold mt-2">Define your launch target</h4>
                <p className="text-white/60 text-sm mt-1">
                  Clarify your audience, service area, offer, and first milestone.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/customer-offer`}
                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
              >
                <span className="text-brand-gold font-semibold">02</span>
                <h4 className="text-lg font-semibold mt-2">Build your customer offer</h4>
                <p className="text-white/60 text-sm mt-1">
                  Turn the idea into a clear service, pricing structure, and customer action.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/customer-foundation`}
                className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 hover:bg-brand-gold/10 transition"
              >
                <span className="text-brand-gold font-semibold">03</span>
                <h4 className="text-lg font-semibold mt-2">Build your customer foundation</h4>
                <p className="text-white/60 text-sm mt-1">
                  Create the website, booking flow, or application customers will use.
                </p>
              </Link>

              <Link
                href={`/projects/${params.id}/launch-content`}
                className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 hover:bg-brand-gold/10 transition"
              >
                <span className="text-brand-gold font-semibold">04</span>
                <h4 className="text-lg font-semibold mt-2">Create your launch content</h4>
                <p className="text-white/60 text-sm mt-1">
                  Build a practical 30/60/90-day plan from your positioning.
                </p>
              </Link>
            </div>
          </div>

          <div className="space-y-7">
            {Object.entries(content).map(([key, value]) => (
              <section key={key}>
                <h3 className="text-lg font-semibold capitalize mb-2">{key.replaceAll('_', ' ')}</h3>
                <p className="text-white/80 leading-7 whitespace-pre-wrap">
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
