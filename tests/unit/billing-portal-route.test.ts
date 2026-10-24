import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  row: { stripe_customer_id: 'cus_1' } as { stripe_customer_id: string | null } | null,
  readError: null as { message: string } | null,
  portalError: null as Error | null,
  portalCalls: [] as { params: unknown; options: unknown }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: mocks.readError ? null : mocks.row, error: mocks.readError }),
      }
      return builder
    },
  }),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: () => ({
    billingPortal: {
      sessions: {
        create: async (params: unknown, options: unknown) => {
          mocks.portalCalls.push({ params, options })
          if (mocks.portalError) throw mocks.portalError
          return { url: 'https://billing.stripe.test/session/bps_1' }
        },
      },
    },
  }),
}))

import { POST } from '@/app/api/billing/portal/route'
import { STRIPE_REQUEST_LIMITS } from '@/lib/stripe/limits'

const portalRequest = () => new Request('https://hke.test/api/billing/portal', { method: 'POST' })

beforeEach(() => {
  mocks.user = { id: 'user-1' }
  mocks.row = { stripe_customer_id: 'cus_1' }
  mocks.readError = null
  mocks.portalError = null
  mocks.portalCalls = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/billing/portal', () => {
  it("opens the Stripe Customer Portal for the person's own customer and returns them to the dashboard", async () => {
    const response = await POST(portalRequest())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://billing.stripe.test/session/bps_1')
    expect(mocks.portalCalls).toEqual([{ params: { customer: 'cus_1', return_url: 'https://hke.test/dashboard' }, options: STRIPE_REQUEST_LIMITS }])
  })

  it('sends a signed-out visitor to sign in without calling Stripe', async () => {
    mocks.user = null
    const response = await POST(portalRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/login')
    expect(mocks.portalCalls).toHaveLength(0)
  })

  it('explains there is nothing to manage when the account has never reached Stripe', async () => {
    mocks.row = { stripe_customer_id: null }
    const response = await POST(portalRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=no-billing')
    expect(mocks.portalCalls).toHaveLength(0)
  })

  it('shows a retry message when the subscription cannot be read', async () => {
    mocks.readError = { message: 'connection reset' }
    const response = await POST(portalRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=billing-unavailable')
    expect(mocks.portalCalls).toHaveLength(0)
  })

  it('shows a retry message when Stripe cannot open the portal', async () => {
    mocks.portalError = new Error('No configuration provided and your live mode default configuration has not been created.')
    const response = await POST(portalRequest())
    expect(response.headers.get('location')).toBe('https://hke.test/dashboard?error=billing-unavailable')
  })
})
