import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, interviews_used, builds_used, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

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
            <h2 className="text-xl font-semibold mb-2">Your current plan</h2>
            <p className="text-white/70 capitalize">
              {subscription.plan} · {subscription.status}
            </p>
            <p className="text-white/50 text-sm mt-2">
              Interviews used: {subscription.interviews_used} · Builds used: {subscription.builds_used}
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-2">Choose your plan</h2>
            <p className="text-white/60">Start your 3-day trial and begin turning your expertise into digital assets.</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {(Object.entries(PRICING_PLANS) as [PlanKey, typeof PRICING_PLANS[PlanKey]][]).map(([key, plan]) => (
            <div key={key} className={`rounded-2xl p-6 ${key === 'professional' ? 'bg-gradient-to-b from-brand-gold/10 to-brand-pink/10 border border-brand-gold/30' : 'glass'}`}>
              {key === 'professional' && <div className="text-brand-gold text-sm font-semibold mb-2">Most Popular</div>}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <div className="my-5">
                <span className="text-4xl font-bold gradient-text">${plan.price / 100}</span>
                <span className="text-white/40">/month</span>
              </div>
              <ul className="space-y-2 mb-7 text-sm text-white/70">
                {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
              </ul>
              <form action="/api/checkout" method="POST">
                <input type="hidden" name="plan" value={key} />
                <button type="submit" className={key === 'professional' ? 'btn-primary w-full' : 'btn-secondary w-full'}>
                  {subscription?.plan === key ? 'Current Plan' : 'Start 3-Day Trial'}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
