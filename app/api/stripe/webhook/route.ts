import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe/client'
import { createServiceRoleClient } from '@/lib/supabase/server'

function mapStatus(status: Stripe.Subscription.Status): 'active' | 'cancelled' | 'past_due' | 'trialing' {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'past_due') return 'past_due'
  return 'cancelled'
}

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

      if (userId && subscriptionId && customerId && (plan === 'creator' || plan === 'professional' || plan === 'business')) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        const { error: upsertError } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan,
          status: mapStatus(subscription.status),
          interviews_used: 0,
          builds_used: 0,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        if (upsertError) {
          console.error('Subscription upsert failed:', upsertError.message)
          return NextResponse.json({ error: 'Database sync failed' }, { status: 500 })
        }
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
      const newPeriodStart = new Date(subscription.current_period_start * 1000).toISOString()

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('current_period_start')
        .eq('stripe_customer_id', customerId)
        .single()

      const isNewPeriod = existing?.current_period_start && existing.current_period_start !== newPeriodStart

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: subscription.id,
          status: event.type === 'customer.subscription.deleted' ? 'cancelled' : mapStatus(subscription.status),
          current_period_start: newPeriodStart,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          ...(isNewPeriod ? { interviews_used: 0, builds_used: 0 } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId)

      if (updateError) {
        console.error('Subscription update failed:', updateError.message)
        return NextResponse.json({ error: 'Database sync failed' }, { status: 500 })
      }
    }
  } catch (error) {
    console.error('Stripe webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
