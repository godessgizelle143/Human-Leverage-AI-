import type Stripe from 'stripe'

type SubscriptionPeriodItem = Stripe.SubscriptionItem & {
  current_period_start?: number
  current_period_end?: number
}

// Stripe API versions before 2025-03-31 (including the 2023-10-16 version this
// client is pinned to) put the billing period on the subscription; newer
// versions put it on each subscription item. Webhook payloads follow the
// endpoint's API version, so read the item first and fall back to the
// subscription.
export function getSubscriptionPeriod(
  subscription: Stripe.Subscription
): { start: string; end: string } | null {
  const item = subscription.items?.data[0] as SubscriptionPeriodItem | undefined
  const legacy = subscription as Partial<Pick<Stripe.Subscription, 'current_period_start' | 'current_period_end'>>

  const start = item?.current_period_start ?? legacy.current_period_start
  const end = item?.current_period_end ?? legacy.current_period_end

  if (start == null || end == null) {
    return null
  }

  return {
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString()
  }
}
