import { describe, expect, it } from 'vitest'
import { checkoutTrial, NEW_ACCOUNT_TRIAL_DAYS } from '@/lib/stripe/policy'

const now = new Date('2026-10-08T12:00:00Z')
const inHours = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString()

const cardlessTrial = (endsInHours: number) => ({
  status: 'trialing',
  stripe_subscription_id: null,
  trial_started_at: inHours(endsInHours - 72),
  current_period_end: inHours(endsInHours),
})

describe('checkoutTrial', () => {
  it('gives an account with no subscription row the standard trial', () => {
    expect(checkoutTrial(null, now)).toEqual({ trial_period_days: NEW_ACCOUNT_TRIAL_DAYS })
  })

  it('carries over the remaining cardless trial without adding days', () => {
    const existing = cardlessTrial(60)
    expect(checkoutTrial(existing, now)).toEqual({ trial_end: Math.floor(new Date(existing.current_period_end).getTime() / 1000) })
  })

  it('bills immediately when the cardless trial has less than 48 hours left', () => {
    expect(checkoutTrial(cardlessTrial(47), now)).toBeNull()
  })

  it('bills immediately once the cardless trial has ended', () => {
    expect(checkoutTrial({ ...cardlessTrial(-1), status: 'trialing' }, now)).toBeNull()
  })

  it('never grants another trial to an account that has had a Stripe subscription', () => {
    expect(checkoutTrial({ status: 'cancelled', stripe_subscription_id: 'sub_old', trial_started_at: null, current_period_end: inHours(-100) }, now)).toBeNull()
  })
})
