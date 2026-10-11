import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { supabaseBillingStore } from '@/lib/stripe/billing-store'
import { RetryableSyncError, UnexpectedWriteError, type BillingRow } from '@/lib/stripe/sync'
import type { Database } from '@/types/database'

type Result = { data: unknown; error: { message: string; code?: string } | null }

/**
 * Records each query the store builds and answers it from a script:
 * `update` for the conditional write, `read` for the re-read afterwards.
 * This checks the store's logic and the filters it sends; it does not prove
 * how the real PostgREST API evaluates them.
 */
function fakeSupabase(script: { update: Result; read?: Result }) {
  const queries: { op: 'update' | 'select'; filters: string[]; values?: unknown }[] = []
  const client = {
    from() {
      const query: (typeof queries)[number] = { op: 'select', filters: [] }
      queries.push(query)
      const builder = {
        update(values: unknown) { query.op = 'update'; query.values = values; return builder },
        select() { return builder },
        eq(column: string, value: unknown) { query.filters.push(`${column}=eq.${value}`); return builder },
        is(column: string, value: unknown) { query.filters.push(`${column}=is.${value}`); return builder },
        maybeSingle() { return builder },
        then(resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) {
          const result = query.op === 'update' ? script.update : script.read
          return Promise.resolve(result ?? { data: null, error: { message: 'unexpected read' } }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, queries }
}

const expected = { userId: 'user-1', subscriptionId: 'sub_1', periodStart: '2026-10-01T00:00:00+00:00' }
const values = { stripe_subscription_id: 'sub_1', status: 'active' as const, current_period_start: '2026-11-01T00:00:00.000Z', current_period_end: '2026-12-01T00:00:00.000Z' }
const row = (overrides: Partial<BillingRow> = {}): BillingRow => ({ user_id: 'user-1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', current_period_start: '2026-10-01T00:00:00+00:00', ...overrides })

describe('supabaseBillingStore.update', () => {
  it('sends the expected-state filters and reports a matched row as updated', async () => {
    const db = fakeSupabase({ update: { data: [{ user_id: 'user-1' }], error: null } })
    await expect(supabaseBillingStore(db.client).update(expected, values)).resolves.toBe('updated')
    expect(db.queries[0].filters).toEqual(['user_id=eq.user-1', 'stripe_subscription_id=eq.sub_1', 'current_period_start=eq.2026-10-01T00:00:00+00:00'])
  })

  it('uses IS NULL filters for a row with no subscription yet', async () => {
    const db = fakeSupabase({ update: { data: [{ user_id: 'user-1' }], error: null } })
    await supabaseBillingStore(db.client).update({ userId: 'user-1', subscriptionId: null, periodStart: null }, values)
    expect(db.queries[0].filters).toEqual(['user_id=eq.user-1', 'stripe_subscription_id=is.null', 'current_period_start=is.null'])
  })

  it('reports a genuine concurrent change as a conflict after re-reading the row', async () => {
    const db = fakeSupabase({ update: { data: [], error: null }, read: { data: row({ current_period_start: '2026-11-01T00:00:00+00:00' }), error: null } })
    await expect(supabaseBillingStore(db.client).update(expected, values)).resolves.toBe('conflict')
    expect(db.queries.map((query) => query.op)).toEqual(['update', 'select'])
  })

  it('treats a replaced subscription id as a conflict', async () => {
    const db = fakeSupabase({ update: { data: [], error: null }, read: { data: row({ stripe_subscription_id: 'sub_2' }), error: null } })
    await expect(supabaseBillingStore(db.client).update(expected, values)).resolves.toBe('conflict')
  })

  it('raises a diagnosable error when nothing matched but the row is unchanged', async () => {
    // Same instant written in a different format: still "unchanged", so a filter-encoding problem is not hidden as a race.
    const db = fakeSupabase({ update: { data: [], error: null }, read: { data: row({ current_period_start: '2026-10-01T00:00:00.000Z' }), error: null } })
    const attempt = supabaseBillingStore(db.client).update(expected, values)
    await expect(attempt).rejects.toBeInstanceOf(UnexpectedWriteError)
    await expect(attempt).rejects.toThrow(/row still has subscription sub_1.*check service-role key, RLS, and filter encoding/)
  })

  it('raises a diagnosable error when the row has disappeared', async () => {
    const db = fakeSupabase({ update: { data: [], error: null }, read: { data: null, error: null } })
    await expect(supabaseBillingStore(db.client).update(expected, values)).rejects.toThrow(/row for user-1 is missing/)
  })

  it('keeps database errors retryable without classifying them as write anomalies', async () => {
    const db = fakeSupabase({ update: { data: null, error: { message: 'connection reset' } } })
    const attempt = supabaseBillingStore(db.client).update(expected, values)
    await expect(attempt).rejects.toBeInstanceOf(RetryableSyncError)
    await expect(attempt).rejects.not.toBeInstanceOf(UnexpectedWriteError)
  })

  it('fails retryably when the re-read itself fails', async () => {
    const db = fakeSupabase({ update: { data: [], error: null }, read: { data: null, error: { message: 'timeout' } } })
    await expect(supabaseBillingStore(db.client).update(expected, values)).rejects.toThrow(/Subscription read failed: timeout/)
  })
})
