import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/stripe/webhook/route'
import { RetryableSyncError, UnexpectedWriteError, type BillingStore } from '@/lib/stripe/sync'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
  store: null as unknown as BillingStore,
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent }, subscriptions: { retrieve: mocks.retrieve } }),
}))
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/stripe/billing-store', () => ({ supabaseBillingStore: () => mocks.store }))

const stripeSubscription = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'canceled',
  metadata: { user_id: 'user-1', plan: 'professional' },
  items: { data: [{ current_period_start: 1759276800, current_period_end: 1761955200 }] },
}

function request() {
  return new Request('https://hke.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' })
}

beforeEach(() => {
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  mocks.constructEvent.mockReset()
  mocks.retrieve.mockReset().mockResolvedValue(stripeSubscription)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/stripe/webhook', () => {
  it('rejects an invalid signature without touching Stripe or the database', async () => {
    mocks.constructEvent.mockImplementation(() => { throw new Error('bad signature') })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(mocks.retrieve).not.toHaveBeenCalled()
  })

  it('returns a retryable 500 and writes nothing when the stored row cannot be read', async () => {
    const update = vi.fn()
    mocks.store = {
      findByUserId: async () => { throw new RetryableSyncError('read failed') },
      findByCustomerId: async () => { throw new RetryableSyncError('read failed') },
      insert: vi.fn(),
      update,
    }
    mocks.constructEvent.mockReturnValue({ id: 'evt_1', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } })
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(update).not.toHaveBeenCalled()
  })

  it('re-reads the subscription from Stripe instead of trusting the event payload', async () => {
    const update = vi.fn(async () => 'updated' as const)
    mocks.store = {
      findByUserId: async () => ({ user_id: 'user-1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', current_period_start: new Date(1759276800 * 1000).toISOString() }),
      findByCustomerId: async () => null,
      insert: vi.fn(),
      update,
    }
    // The payload claims "active"; Stripe says the subscription is canceled.
    mocks.constructEvent.mockReturnValue({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active' } } })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_1', { timeout: 10_000, maxNetworkRetries: 1 })
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'cancelled' }))
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ builds_used: 0 }))
  })

  it('reports both subscriptions on a duplicate and changes nothing', async () => {
    const update = vi.fn()
    mocks.store = {
      findByUserId: async () => ({ user_id: 'user-1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_kept', status: 'active', current_period_start: '2026-10-01T00:00:00+00:00' }),
      findByCustomerId: async () => null,
      insert: vi.fn(),
      update,
    }
    mocks.retrieve.mockImplementation(async (id: string) => ({ ...stripeSubscription, id, status: 'active' }))
    mocks.constructEvent.mockReturnValue({ id: 'evt_dup', type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_dup', metadata: { user_id: 'user-1', plan: 'professional' } } } })

    const response = await POST(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ reason: 'duplicate_live_subscription', keptSubscriptionId: 'sub_kept', duplicateSubscriptionId: 'sub_dup', userId: 'user-1', eventId: 'evt_dup' })
    expect(update).not.toHaveBeenCalled()
    expect(mocks.retrieve).toHaveBeenCalledTimes(2) // the event's subscription and the recorded one; nothing is cancelled
  })

  it('returns a retryable 500 when a conditional write matches nothing unexpectedly', async () => {
    mocks.store = {
      findByUserId: async () => ({ user_id: 'user-1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', current_period_start: new Date(1759276800 * 1000).toISOString() }),
      findByCustomerId: async () => null,
      insert: vi.fn(),
      update: async () => { throw new UnexpectedWriteError('matched no rows but the row is unchanged') },
    }
    mocks.constructEvent.mockReturnValue({ id: 'evt_4', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } })
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(console.error).toHaveBeenCalledWith('Stripe webhook processing error:', 'evt_4', 'matched no rows but the row is unchanged')
  })

  it('acknowledges unrelated events without syncing', async () => {
    mocks.constructEvent.mockReturnValue({ id: 'evt_3', type: 'invoice.paid', data: { object: {} } })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.retrieve).not.toHaveBeenCalled()
  })

  it('reads the subscription from Stripe with the bounded timeout and retry settings', async () => {
    mocks.store = { findByUserId: async () => null, findByCustomerId: async () => null, insert: vi.fn(), update: vi.fn() }
    mocks.constructEvent.mockReturnValue({ id: 'evt_bounded', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } })
    await POST(request())
    expect(mocks.retrieve).toHaveBeenCalledTimes(1)
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_1', { timeout: 10_000, maxNetworkRetries: 1 })
  })

  it('returns a retryable 500 and writes nothing when the Stripe read times out', async () => {
    const insert = vi.fn()
    const update = vi.fn()
    const findByUserId = vi.fn(async () => null)
    mocks.store = { findByUserId, findByCustomerId: vi.fn(async () => null), insert, update }
    mocks.retrieve.mockRejectedValue(new Stripe.errors.StripeConnectionError({ message: 'Request aborted due to timeout being reached (10000ms)' } as never))
    mocks.constructEvent.mockReturnValue({ id: 'evt_timeout', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Webhook processing failed' }) // the Stripe error text is logged, not returned
    expect(findByUserId).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Stripe webhook processing error:', 'evt_timeout', expect.stringContaining('timeout'))
  })

  it('still treats a subscription Stripe no longer has as superseded, not as a failure', async () => {
    const update = vi.fn()
    mocks.store = { findByUserId: vi.fn(async () => null), findByCustomerId: vi.fn(async () => null), insert: vi.fn(), update }
    mocks.retrieve.mockRejectedValue(new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error', code: 'resource_missing', message: 'No such subscription' } as never))
    mocks.constructEvent.mockReturnValue({ id: 'evt_missing', type: 'customer.subscription.deleted', data: { object: { id: 'sub_gone' } } })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, action: 'ignore', reason: 'superseded' })
    expect(update).not.toHaveBeenCalled()
  })
})
