import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { getSubscriptionPeriod } from '@/lib/stripe/period'

const START = 1767225600 // 2026-01-01T00:00:00Z
const END = 1769904000 // 2026-02-01T00:00:00Z

function subscription(shape: Record<string, unknown>) {
  return shape as unknown as Stripe.Subscription
}

describe('getSubscriptionPeriod', () => {
  it('reads the subscription-level period used by the pinned 2023-10-16 API version', () => {
    expect(getSubscriptionPeriod(subscription({ current_period_start: START, current_period_end: END, items: { data: [{ id: 'si_1' }] } }))).toEqual({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-02-01T00:00:00.000Z',
    })
  })

  it('reads the item-level period used by newer API versions', () => {
    expect(getSubscriptionPeriod(subscription({ items: { data: [{ id: 'si_1', current_period_start: START, current_period_end: END }] } }))?.end).toBe('2026-02-01T00:00:00.000Z')
  })

  it('returns null when no period is present', () => {
    expect(getSubscriptionPeriod(subscription({ items: { data: [] } }))).toBeNull()
  })
})
