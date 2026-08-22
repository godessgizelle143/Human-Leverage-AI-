import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { isHumanLeverageOwner } from '@/lib/owner-access'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const isOwner = isHumanLeverageOwner(user.email)

  let { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, interviews_used, builds_used, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // New authenticated users receive the cardless trial through the database RPC.
  // This keeps trial creation behind auth.uid() and avoids a direct subscriptions INSERT.
  if (!subscription) {
    const { error: trialError } = await supabase.rpc('start_trial')
    if (!trialError) {
      const { data: created } = await supabase
        .from('subscriptions')
        .select('plan, status, interviews_used, builds_used, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()
      subscription = created
    }
  }

  const trialEnded = !!subscription?.current_period_end && new Date(subscription.current_period_end) <= new Date()
  const hasAccess = isOwner || (!!subscription && ['active', 'trialing'].includes(subscription.status) && !trialEnded)

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p>
          <h1 className="text-4xl font-bold mb-3">Welcome to your dashboard</h1>
          <p className="text-white/60">{user.email}</p>
        </div>

        {subscription ? (
          <div className="glass rounded-2xl p-6 mb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your current plan</h2>
                <p className="text-white/70 capitalize">{isOwner ? 'Owner · test access' : trialEnded ? 'free trial ended' : `${subscription.plan} · ${subscription.status}`}</p>
                <p className="text-white/50 text-sm mt-2">Interviews used: {subscription.interviews_used} · Builds used: {subscription.builds_used}</p>
              </div>
              {hasAccess ? (
                <Link href="/builder" className="btn-primary inline-flex items-center justify-center px-6 py-3">🚀 Start a New Project</Link>
              ) : (
                <div className="text-sm text-white/60">Choose a plan below to continue building.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 mb-10"><h2 className="text-xl font-semibold mb-2">Choose your plan</h2><p className="text-white/60">Start your 3-day free trial with no credit card required.</p></div>
        )}

        {projects && projects.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-brand-gold text-sm font-semibold">YOUR WORK</p>
                <h2 className="text-2xl font-bold">Saved Projects</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="glass rounded-2xl p-5 hover:border-brand-gold/40 transition-colors">
                  <h3 className="text-lg font-semibold">{project.title}</h3>
                  <p className="text-white/50 text-sm mt-2 capitalize">{project.status} · {new Date(project.created_at).toLocaleDateString()}</p>
                  <p className="text-brand-gold text-sm mt-4">Open project →</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid md:grid-cols-3 gap-6">
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
