import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Session = { id: string; created: number; url: string; status: 'open' | 'expired' | 'complete' }

const mocks = vi.hoisted(() => ({
  sessions: [] as Session[],
  subscriptionStatuses: [] as string[],
  failExpiry: new Set<string>(),
  lockHolder: null as string | null,
  /** Makes the lock adapter behave as it does when the database refuses, loses, or cannot reach the lock. */
  lockFault: null as null | 'renew-refused' | 'acquire-error',
  /** Replaces what Stripe returns when the created session is retrieved. */
  retrieve: null as null | (() => unknown),
  stripeOptions: [] as { call: string; options: unknown }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'owner@example.com' } } }) },
    rpc: async () => ({ error: null }),
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: { stripe_customer_id: 'cus_1', stripe_subscription_id: null, status: 'trialing', trial_started_at: '2026-10-08T00:00:00Z', current_period_end: '2099-01-01T00:00:00Z' },
          error: null,
        }),
      }
      return builder
    },
  }),
  createServiceRoleClient: () => ({}),
}))

vi.mock('@/lib/stripe/billing-store', () => ({
  supabaseCustomerClaim: () => ({ claim: async (_userId: string, customerId: string) => customerId }),
  supabaseCheckoutLock: () => ({
    acquire: async (_userId: string, token: string) => {
      if (mocks.lockFault === 'acquire-error') throw new Error('Checkout lock acquire failed: Could not find the function public.acquire_checkout_lock')
      if (mocks.lockHolder) return false
      mocks.lockHolder = token
      return true
    },
    renew: async (_userId: string, token: string) => mocks.lockFault !== 'renew-refused' && mocks.lockHolder === token,
    release: async (_userId: string, token: string) => {
      if (mocks.lockHolder === token) mocks.lockHolder = null
    },
  }),
}))

vi.mock('@/lib/stripe/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stripe/client')>()),
  getStripeClient: () => ({
    customers: { create: vi.fn(), del: vi.fn() },
    subscriptions: { list: async (_params: unknown, options: unknown) => { mocks.stripeOptions.push({ call: 'subscriptions.list', options }); return { data: mocks.subscriptionStatuses.map((status) => ({ status })) } } },
    checkout: {
      sessions: {
        list: async (_params: unknown, options: unknown) => { mocks.stripeOptions.push({ call: 'sessions.list', options }); return { data: mocks.sessions.filter((session) => session.status === 'open') } },
        create: async (_params: unknown, options: unknown) => {
          mocks.stripeOptions.push({ call: 'sessions.create', options })
          const session: Session = { id: 'cs_new', created: 2, url: 'https://checkout.stripe.test/cs_new', status: 'open' }
          mocks.sessions.push(session)
          return session
        },
        retrieve: async (id: string, options: unknown) => {
          mocks.stripeOptions.push({ call: 'sessions.retrieve', options })
          if (mocks.retrieve) return mocks.retrieve()
          const session = mocks.sessions.find((candidate) => candidate.id === id)!
          return { id: session.id, customer: 'cus_1', status: session.status, url: session.url, expires_at: 4102444800 }
        },
        expire: async (id: string, options: unknown) => {
          mocks.stripeOptions.push({ call: 'sessions.expire', options })
          if (mocks.failExpiry.has(id)) throw new Error('Stripe API temporarily unavailable')
          mocks.sessions.find((session) => session.id === id)!.status = 'expired'
        },
      },
    },
  }),
}))

import { POST } from '@/app/api/checkout/route'

function checkoutRequest() {
  const form = new FormData()
  form.set('plan', 'professional')
  return new Request('https://hke.test/api/checkout', { method: 'POST', body: form })
}

beforeEach(() => {
  mocks.sessions = [{ id: 'cs_old', created: 1, url: 'https://checkout.stripe.test/cs_old', status: 'open' }]
  mocks.subscriptionStatuses = []
  mocks.failExpiry = new Set()
  mocks.lockHolder = null
  mocks.lockFault = null
  mocks.retrieve = null
  mocks.stripeOptions = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/checkout', () => {
  it('expires the earlier session and redirects to the new one', async () => {
    const response = await POST(checkoutRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/cs_new')
    expect(mocks.sessions.find((session) => session.id === 'cs_old')?.status).toBe('expired')
  })

  it('does not return a payable URL when the earlier session cannot be expired', async () => {
    mocks.failExpiry.add('cs_old')
    const response = await POST(checkoutRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-retry')
    // The new session was never handed out and is not left payable.
    expect(mocks.sessions.find((session) => session.id === 'cs_new')?.status).toBe('expired')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CHECKOUT CLEANUP FAILED'), expect.stringContaining('"stillOpen":["cs_old"]'))
  })

  it('sends a customer with a payment still processing back to the dashboard', async () => {
    mocks.subscriptionStatuses = ['incomplete']
    const response = await POST(checkoutRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=payment-pending')
  })

  it('releases the checkout lock after every outcome', async () => {
    await POST(checkoutRequest())
    expect(mocks.lockHolder).toBeNull()
    mocks.failExpiry.add('cs_old')
    mocks.sessions = [{ id: 'cs_old', created: 1, url: 'https://checkout.stripe.test/cs_old', status: 'open' }]
    await POST(checkoutRequest())
    expect(mocks.lockHolder).toBeNull()
  })

  it('asks the user to retry, without creating a session, while another checkout holds the lock', async () => {
    vi.useFakeTimers()
    try {
      mocks.lockHolder = 'another-request'
      const pending = POST(checkoutRequest())
      await vi.runAllTimersAsync()
      const response = await pending
      expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-retry')
      expect(mocks.sessions.map((session) => session.id)).toEqual(['cs_old'])
      expect(mocks.sessions[0].status).toBe('open')
      expect(mocks.lockHolder).toBe('another-request') // the other request's lock is untouched
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CHECKOUT CONTENDED'), expect.stringContaining('"reason":"lock-busy"'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends every Stripe request with the bounded timeout and retry settings', async () => {
    await POST(checkoutRequest())
    expect(mocks.stripeOptions.map((entry) => entry.call).sort()).toEqual(['sessions.create', 'sessions.expire', 'sessions.list', 'sessions.retrieve', 'subscriptions.list', 'subscriptions.list'])
    for (const entry of mocks.stripeOptions) expect(entry.options, entry.call).toEqual({ timeout: 10_000, maxNetworkRetries: 1 })
  })

  it('redirects only after retrieving the created session', async () => {
    const response = await POST(checkoutRequest())
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/cs_new')
    expect(mocks.stripeOptions.filter((entry) => entry.call === 'sessions.retrieve')).toHaveLength(1)
  })

  it('asks the user to retry, with no checkout URL, when the lock is lost', async () => {
    mocks.lockFault = 'renew-refused'
    const response = await POST(checkoutRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-retry')
    expect(mocks.sessions.map((session) => session.id)).toEqual(['cs_old']) // nothing was created or expired
    expect(mocks.sessions[0].status).toBe('open')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CHECKOUT CONTENDED'), expect.stringContaining('"reason":"lock-lost"'))
  })

  it.each([
    ['not-open', () => ({ id: 'cs_new', customer: 'cus_1', status: 'expired', url: null, expires_at: 4102444800 })],
    ['wrong-customer', () => ({ id: 'cs_new', customer: 'cus_other', status: 'open', url: 'https://checkout.stripe.test/cs_new', expires_at: 4102444800 })],
    ['wrong-customer', () => ({ id: 'cs_new', customer: { id: 'cus_other' }, status: 'open', url: 'https://checkout.stripe.test/cs_new', expires_at: 4102444800 })],
    ['expired', () => ({ id: 'cs_new', customer: 'cus_1', status: 'open', url: 'https://checkout.stripe.test/cs_new', expires_at: 1 })],
    ['missing', () => { throw new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error', code: 'resource_missing', message: 'No such checkout.session' }) }],
  ] as const)('asks the user to retry, with no checkout URL, when the created session is %s', async (problem, retrieve) => {
    mocks.retrieve = retrieve
    const response = await POST(checkoutRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-retry')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CHECKOUT CONTENDED'), expect.stringContaining(`"reason":"session-stale","problem":"${problem}"`))
    expect(mocks.lockHolder).toBeNull()
  })

  it('reports checkout as unavailable, creating nothing, when the lock functions are missing', async () => {
    mocks.lockFault = 'acquire-error'
    const response = await POST(checkoutRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-unavailable')
    expect(mocks.sessions.map((session) => session.id)).toEqual(['cs_old'])
    expect(mocks.stripeOptions).toEqual([])
    expect(console.error).toHaveBeenCalledWith('CHECKOUT ERROR:', expect.stringContaining('Checkout lock acquire failed'))
  })

  it('reports checkout as unavailable, leaving no payable session of its own, when Stripe fails while verifying it', async () => {
    mocks.retrieve = () => { throw new Error('Request timed out') }
    const response = await POST(checkoutRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=checkout-unavailable')
    expect(response.headers.get('location')).not.toContain('timed out') // internal errors are not shown to the user
    expect(mocks.sessions.find((session) => session.id === 'cs_new')?.status).toBe('expired')
    expect(mocks.lockHolder).toBeNull()
  })
})
