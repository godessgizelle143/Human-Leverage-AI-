import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripeClient, PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }

  const formData = await request.formData()
  const plan = formData.get('plan')

  if (typeof plan !== 'string' || !(plan in PRICING_PLANS)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const planKey = plan as PlanKey
  const selectedPlan = PRICING_PLANS[planKey]
  const stripe = getStripeClient()
  const origin = new URL(request.url).origin

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingSubscription?.stripe_subscription_id && ['active', 'trialing'].includes(existingSubscription.status)) {
    return NextResponse.redirect(new URL('/dashboard?error=already-subscribed', request.url), 303)
  }

  let customerId = existingSubscription?.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Human Leverage AI™ ${selectedPlan.name}` },
          unit_amount: selectedPlan.price,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 3,
      metadata: {
        user_id: user.id,
        plan: planKey,
      },
    },
    payment_method_collection: 'if_required',
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/dashboard?checkout=cancelled`,
    metadata: {
      user_id: user.id,
      plan: planKey,
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
  }

  return NextResponse.redirect(session.url, 303)
}
