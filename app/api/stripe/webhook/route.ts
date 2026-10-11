import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe/client'
import { supabaseBillingStore } from '@/lib/stripe/billing-store'
import { STRIPE_REQUEST_LIMITS } from '@/lib/stripe/limits'
import { syncSubscription, toRemoteSubscription, type SyncDeps } from '@/lib/stripe/sync'
import { createServiceRoleClient } from '@/lib/supabase/server'

const SUBSCRIPTION_EVENTS = new Set<Stripe.Event['type']>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook configuration missing' },
      { status: 400 }
    )
  }

  const body = await request.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Invalid webhook signature'

    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }

  // The event only says which subscription to look at; its current state is
  // always re-read from Stripe, so retries and out-of-order deliveries settle
  // on the same result.
  let target: { subscriptionId: string; userId?: string | null; plan?: unknown } | null = null

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (session.mode === 'subscription' && subscriptionId) {
      target = { subscriptionId, userId: session.metadata?.user_id, plan: session.metadata?.plan }
    }
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    target = { subscriptionId: (event.data.object as Stripe.Subscription).id }
  }

  if (!target) return NextResponse.json({ received: true })

  const deps: SyncDeps = {
    store: supabaseBillingStore(createServiceRoleClient()),
    async retrieve(subscriptionId) {
      try {
        // Bounded so a slow Stripe ends in a 500 that Stripe redelivers, not a request that hangs.
        return toRemoteSubscription(await stripe.subscriptions.retrieve(subscriptionId, STRIPE_REQUEST_LIMITS))
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') return null
        throw error
      }
    },
  }

  try {
    const result = await syncSubscription(deps, target)

    if (result.action === 'ignore' && result.reason === 'duplicate_live_subscription') {
      // Two subscriptions are billing one account. Entitlement stays on the
      // recorded one; which to cancel or refund is a human decision (both may
      // have been paid, possibly for different plans), so nothing is changed in
      // Stripe. The ids are also returned so they appear in Stripe's webhook log.
      const report = { eventId: event.id, userId: result.userId, keptSubscriptionId: result.keptSubscriptionId, duplicateSubscriptionId: result.duplicateSubscriptionId }
      console.error('DUPLICATE LIVE SUBSCRIPTION — manual review required:', JSON.stringify(report))
      return NextResponse.json({ received: true, action: 'ignore', reason: result.reason, ...report })
    }

    return NextResponse.json({ received: true, action: result.action, ...(result.action === 'ignore' ? { reason: result.reason } : {}) })
  } catch (error) {
    // Any failure leaves the stored row untouched; 500 makes Stripe retry.
    console.error('Stripe webhook processing error:', event.id, error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
