/** Stripe Checkout rejects a subscription trial_end less than 48 hours away. */
export const MIN_CHECKOUT_TRIAL_MS = 48 * 60 * 60 * 1000

export const NEW_ACCOUNT_TRIAL_DAYS = 3

type ExistingSubscription = {
  status: string
  stripe_subscription_id: string | null
  trial_started_at: string | null
  current_period_end: string | null
} | null

export type CheckoutTrial = { trial_period_days: number } | { trial_end: number } | null

/**
 * Each account gets one free trial. A user who has never had one gets the
 * standard trial; a user still inside the cardless trial keeps its remaining
 * time (no extra days); anyone who has already trialed or paid is billed
 * immediately. Without this, every new checkout (including after cancelling)
 * granted a fresh trial and the webhook reset the credit counters.
 */
export function checkoutTrial(existing: ExistingSubscription, now = new Date()): CheckoutTrial {
  if (!existing) return { trial_period_days: NEW_ACCOUNT_TRIAL_DAYS }
  if (existing.stripe_subscription_id) return null
  if (existing.status === 'trialing' && existing.current_period_end) {
    const end = new Date(existing.current_period_end).getTime()
    if (end - now.getTime() >= MIN_CHECKOUT_TRIAL_MS) return { trial_end: Math.floor(end / 1000) }
  }
  return null
}
