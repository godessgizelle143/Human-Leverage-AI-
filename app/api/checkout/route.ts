import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { supabaseCheckoutLock, supabaseCustomerClaim } from '@/lib/stripe/billing-store'
import { CHECKOUT_STRIPE_REQUEST, startCheckout, type CheckoutGateway } from '@/lib/stripe/checkout'
import { getStripeClient, PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { checkoutTrial } from '@/lib/stripe/policy'

// Covers the wait for a busy checkout lock plus a run of slow Stripe calls. A
// request cut off here leaves its lock to expire with the lease.
export const maxDuration = 60

const SUBSCRIPTION_COLUMNS = 'stripe_customer_id, stripe_subscription_id, status, trial_started_at, current_period_end'

function dashboardRedirect(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/dashboard?error=${error}`, request.url), 303)
}

async function readSubscription(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Subscription read failed: ${error.message}`)
  return data
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }

  const formData = await request.formData()
  const plan = formData.get('plan')

  if (typeof plan !== 'string' || !(plan in PRICING_PLANS)) {
    return dashboardRedirect(request, 'invalid-plan')
  }

  const planKey = plan as PlanKey
  const selectedPlan = PRICING_PLANS[planKey]
  const origin = new URL(request.url).origin

  try {
    // Every account has a subscriptions row (the cardless trial) before it
    // reaches Stripe, so the Stripe customer can be claimed on it.
    let existingSubscription = await readSubscription(supabase, user.id)
    if (!existingSubscription) {
      const { error } = await supabase.rpc('start_trial')
      if (error) throw new Error(`Trial creation before checkout failed: ${error.message}`)
      existingSubscription = await readSubscription(supabase, user.id)
    }

    // Fast path from the stored row; startCheckout re-checks Stripe itself.
    if (existingSubscription?.stripe_subscription_id) {
      const status = existingSubscription.status
      if (['active', 'trialing'].includes(status)) return dashboardRedirect(request, 'already-subscribed')
      if (status === 'past_due') return dashboardRedirect(request, 'payment-required')
    }

    const trial = checkoutTrial(existingSubscription ?? null)
    const stripe = getStripeClient()
    // Bounded so no Stripe call can outlast the checkout lock lease.
    const bounded = CHECKOUT_STRIPE_REQUEST

    const gateway: CheckoutGateway = {
      async createCustomer({ userId, email }) {
        return (await stripe.customers.create({ email: email ?? undefined, metadata: { user_id: userId } }, bounded)).id
      },
      async deleteCustomer(customerId) {
        await stripe.customers.del(customerId, bounded)
      },
      async listSubscriptionStatuses(customerId) {
        const { data } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 }, bounded)
        return data.map((subscription) => subscription.status)
      },
      async listOpenSessions(customerId) {
        const { data } = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 }, bounded)
        return data.map(({ id, created, url }) => ({ id, created, url }))
      },
      async createSession(customerId) {
        const { id, created, url } = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: customerId,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: `HKE ${selectedPlan.name}` },
                unit_amount: selectedPlan.price,
                recurring: { interval: 'month' },
              },
              quantity: 1,
            },
          ],
          subscription_data: {
            ...(trial ?? {}),
            metadata: {
              user_id: user.id,
              plan: planKey,
            },
          },
          payment_method_collection: 'always',
          allow_promotion_codes: true,
          success_url: `${origin}/dashboard?checkout=success`,
          cancel_url: `${origin}/dashboard?checkout=cancelled`,
          metadata: {
            user_id: user.id,
            plan: planKey,
          },
        }, bounded)
        return { id, created, url }
      },
      async retrieveSession(sessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId, bounded)
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
          return { id: session.id, customerId, status: session.status, url: session.url, expiresAt: session.expires_at ?? null }
        } catch (error) {
          if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') return null
          throw error
        }
      },
      async expireSession(sessionId) {
        await stripe.checkout.sessions.expire(sessionId, bounded)
      },
    }

    const serviceClient = createServiceRoleClient()
    const result = await startCheckout(
      { gateway, claims: supabaseCustomerClaim(serviceClient), lock: supabaseCheckoutLock(serviceClient) },
      { userId: user.id, email: user.email ?? null, customerId: existingSubscription?.stripe_customer_id ?? null },
    )

    if (result.kind === 'redirect') return NextResponse.redirect(result.url, 303)
    if (result.kind === 'blocked') return dashboardRedirect(request, result.reason)
    if (result.kind === 'cleanup_failed') {
      // An older checkout is still payable, so a new URL could lead to a second subscription.
      console.error('CHECKOUT CLEANUP FAILED — no new session returned:', JSON.stringify({ userId: user.id, customerId: result.customerId, stillOpen: result.stillOpen, failures: result.failures }))
      return dashboardRedirect(request, 'checkout-retry')
    }
    if (result.kind === 'contended') {
      // Another checkout for this account was running, or the chosen session is no longer open.
      console.error('CHECKOUT CONTENDED — no session returned:', JSON.stringify({ userId: user.id, customerId: result.customerId, reason: result.reason, ...(result.problem ? { problem: result.problem } : {}) }))
      return dashboardRedirect(request, 'checkout-retry')
    }
    return dashboardRedirect(request, 'checkout-unavailable')
  } catch (error) {
    console.error('CHECKOUT ERROR:', error instanceof Error ? error.message : 'Unknown error')
    return dashboardRedirect(request, 'checkout-unavailable')
  }
}
