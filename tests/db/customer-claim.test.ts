import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { supabaseCheckoutLock, supabaseCustomerClaim } from '@/lib/stripe/billing-store'
import { startCheckout, type CheckoutGateway, type OpenSession } from '@/lib/stripe/checkout'
import type { Database } from '@/types/database'
import { createTestDb, newMigrations, seedUser, uuid, type TestDb } from './harness'

/**
 * Runs the real claim_stripe_customer function from the migration on PGlite.
 * PGlite is one in-process connection: calls made "at the same time" here are
 * queued, so these tests show what the function does for each ordering, not
 * how PostgreSQL resolves two transactions that overlap. The role checks use
 * the fixture's roles, not a Supabase project's grants.
 */
let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

type Claim = { claimed: boolean; stored_customer_id: string | null }

async function claim(userId: string | null, customerId: string | null) {
  await t.asService()
  return t.query<Claim>('select * from public.claim_stripe_customer($1, $2)', [userId, customerId])
}

async function stored(userId: string) {
  await t.asSuperuser()
  return t.one<{ stripe_customer_id: string | null; updated_at: string }>('select stripe_customer_id, updated_at from public.subscriptions where user_id = $1', [userId])
}

describe('claim_stripe_customer', () => {
  it('is applied by its own migration, after the checkout lock migration', () => {
    const files = newMigrations().map((migration) => migration.file)
    expect(files).toContain('20261011120000_claim_stripe_customer.sql')
    expect(files.indexOf('20261011120000_claim_stripe_customer.sql')).toBeGreaterThan(files.indexOf('20261010120000_checkout_locks.sql'))
  })

  it('stores the customer for an account that has none and reports the claim as won', async () => {
    const { userId } = await seedUser(t)
    expect((await stored(userId)).stripe_customer_id).toBeNull()

    expect(await claim(userId, 'cus_first')).toEqual([{ claimed: true, stored_customer_id: 'cus_first' }])
    expect((await stored(userId)).stripe_customer_id).toBe('cus_first')
  })

  it('reports a lost claim with the winning id and never overwrites it', async () => {
    const { userId } = await seedUser(t)
    await claim(userId, 'cus_winner')

    expect(await claim(userId, 'cus_loser')).toEqual([{ claimed: false, stored_customer_id: 'cus_winner' }])
    expect(await claim(userId, 'cus_another')).toEqual([{ claimed: false, stored_customer_id: 'cus_winner' }])
    expect((await stored(userId)).stripe_customer_id).toBe('cus_winner')
  })

  it('leaves an already-claimed account untouched, including when the same id is claimed again', async () => {
    const { userId } = await seedUser(t)
    await t.asSuperuser()
    await t.query(`update public.subscriptions set stripe_customer_id = 'cus_existing', updated_at = '2026-01-01T00:00:00Z' where user_id = $1`, [userId])

    expect(await claim(userId, 'cus_existing')).toEqual([{ claimed: false, stored_customer_id: 'cus_existing' }])
    expect(await claim(userId, 'cus_new')).toEqual([{ claimed: false, stored_customer_id: 'cus_existing' }])
    const row = await stored(userId)
    expect(row.stripe_customer_id).toBe('cus_existing')
    expect(new Date(row.updated_at).toISOString()).toBe('2026-01-01T00:00:00.000Z') // a lost claim writes nothing
  })

  it('returns no row for an account without a subscriptions row, and creates none', async () => {
    const { userId } = await seedUser(t, { subscription: false })
    expect(await claim(userId, 'cus_orphan')).toEqual([])
    expect(await stored(userId)).toBeUndefined()
  })

  it('claims per account: one account\'s claim does not affect another', async () => {
    const { userId: first } = await seedUser(t)
    const { userId: second } = await seedUser(t)
    await claim(first, 'cus_a')
    expect(await claim(second, 'cus_b')).toEqual([{ claimed: true, stored_customer_id: 'cus_b' }])
    expect((await stored(first)).stripe_customer_id).toBe('cus_a')
  })

  it('lets exactly one of many queued claims win, and gives every caller the same stored id', async () => {
    const { userId } = await seedUser(t)
    await t.asService()
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => t.query<Claim>('select * from public.claim_stripe_customer($1, $2)', [userId, `cus_${index}`])),
    )
    const rows = results.map((result) => result[0])
    expect(rows.filter((row) => row.claimed)).toHaveLength(1)
    const winner = rows.find((row) => row.claimed)!.stored_customer_id
    expect(new Set(rows.map((row) => row.stored_customer_id))).toEqual(new Set([winner]))
    expect((await stored(userId)).stripe_customer_id).toBe(winner)
  })

  it('raises an error, storing nothing, for a missing user or customer id', async () => {
    const { userId } = await seedUser(t)
    await expect(claim(userId, null)).rejects.toThrow(/customer id is required/)
    await expect(claim(userId, '')).rejects.toThrow(/customer id is required/)
    await expect(claim(userId, '   ')).rejects.toThrow(/customer id is required/)
    await expect(claim(null, 'cus_x')).rejects.toThrow(/user id is required/)
    await expect(t.query('select * from public.claim_stripe_customer($1, $2)', ['not-a-uuid', 'cus_x'])).rejects.toThrow(/uuid/)
    expect((await stored(userId)).stripe_customer_id).toBeNull()
  })

  it('is security definer with a pinned search path and executable only by service_role', async () => {
    const { userId } = await seedUser(t)
    await t.asSuperuser()
    const fn = await t.one<{ prosecdef: boolean; proconfig: string[] }>(`select prosecdef, proconfig from pg_proc where proname = 'claim_stripe_customer' and pronamespace = 'public'::regnamespace`)
    expect(fn).toEqual({ prosecdef: true, proconfig: ['search_path=public, pg_temp'] })
    const grants = await t.query<{ role: string; allowed: boolean }>(
      `select r.role, has_function_privilege(r.role, 'public.claim_stripe_customer(uuid, text)', 'execute') as allowed
       from (values ('anon'), ('authenticated'), ('service_role')) as r(role) order by 1`,
    )
    expect(grants).toEqual([{ role: 'anon', allowed: false }, { role: 'authenticated', allowed: false }, { role: 'service_role', allowed: true }])

    // A signed-in user cannot attach a customer to their own account, or to anyone else's.
    for (const role of ['anon', 'authenticated']) {
      await t.asUser(userId)
      await t.db.exec(`set role ${role}`)
      await expect(t.query('select * from public.claim_stripe_customer($1, $2)', [userId, 'cus_attacker'])).rejects.toThrow(/permission denied/)
    }
    expect((await stored(userId)).stripe_customer_id).toBeNull()
  })
})

/** The slice of the Supabase client the adapters use, answered by the migrated database as service_role. */
function serviceClient() {
  const client = {
    async rpc(fn: string, args: Record<string, unknown>) {
      try {
        await t.asService()
        const names = Object.keys(args)
        const call = `public.${fn}(${names.map((name, index) => `${name} => $${index + 1}`).join(', ')})`
        // PostgREST returns a set-returning function's rows as an array and a scalar function's value directly.
        if (fn === 'claim_stripe_customer') return { data: await t.query(`select * from ${call}`, Object.values(args)), error: null }
        return { data: (await t.one<{ result: unknown }>(`select ${call} as result`, Object.values(args))).result, error: null }
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
      }
    },
  }
  return client as unknown as SupabaseClient<Database>
}

describe('supabaseCustomerClaim over the database function', () => {
  it('returns its own id when it wins and the stored id when it loses', async () => {
    const { userId } = await seedUser(t)
    const claims = supabaseCustomerClaim(serviceClient())
    expect(await claims.claim(userId, 'cus_mine')).toBe('cus_mine')
    expect(await claims.claim(userId, 'cus_late')).toBe('cus_mine')
    expect((await stored(userId)).stripe_customer_id).toBe('cus_mine')
  })

  it('returns null when the account has no subscriptions row', async () => {
    const { userId } = await seedUser(t, { subscription: false })
    expect(await supabaseCustomerClaim(serviceClient()).claim(userId, 'cus_x')).toBeNull()
  })

  it('throws on a database error, so an unknown outcome is never read as a lost claim', async () => {
    const { userId } = await seedUser(t)
    await expect(supabaseCustomerClaim(serviceClient()).claim(userId, '')).rejects.toThrow(/Stripe customer claim failed: .*customer id is required/)

    const missing = { rpc: async () => ({ data: null, error: { message: 'Could not find the function public.claim_stripe_customer(p_customer_id, p_user_id) in the schema cache' } }) } as unknown as SupabaseClient<Database>
    await expect(supabaseCustomerClaim(missing).claim(userId, 'cus_x')).rejects.toThrow(/Stripe customer claim failed: Could not find the function/)
    expect((await stored(userId)).stripe_customer_id).toBeNull()
  })
})

describe('startCheckout over the database claim and lock', () => {
  it('leaves three first-time requests with one stored customer, used by all of them, and deletes the other two', async () => {
    const { userId } = await seedUser(t)
    let nextCustomer = 1
    let nextSession = 1
    const created: string[] = []
    const deleted: string[] = []
    const sessions = new Map<string, OpenSession & { customer: string; status: 'open' | 'expired' }>()
    const gateway: CheckoutGateway = {
      async createCustomer() { const id = `cus_${nextCustomer++}`; created.push(id); return id },
      async deleteCustomer(id) { deleted.push(id) },
      async listSubscriptionStatuses() { return [] },
      async listOpenSessions(customer) {
        return Array.from(sessions.values()).filter((session) => session.customer === customer && session.status === 'open').map(({ id, created: at, url }) => ({ id, created: at, url }))
      },
      async createSession(customer) {
        const id = `cs_${nextSession}`
        sessions.set(id, { id, created: nextSession++, url: `https://checkout.stripe.test/${id}`, customer, status: 'open' })
        return { id, created: sessions.get(id)!.created, url: sessions.get(id)!.url }
      },
      async retrieveSession(id) {
        const session = sessions.get(id)
        return session ? { id, customerId: session.customer, status: session.status, url: session.url, expiresAt: null } : null
      },
      async expireSession(id) { sessions.get(id)!.status = 'expired' },
    }
    const client = serviceClient()
    const deps = { gateway, claims: supabaseCustomerClaim(client), lock: supabaseCheckoutLock(client), timing: { wait: async () => undefined, acquireAttempts: 500 } }

    const results = await Promise.all([1, 2, 3].map(() => startCheckout(deps, { userId, email: null, customerId: null })))

    const winner = (await stored(userId)).stripe_customer_id!
    expect(created).toHaveLength(3)
    expect(created).toContain(winner)
    expect(deleted.sort()).toEqual(created.filter((id) => id !== winner).sort())
    // Every session was created on the stored customer, never on a deleted one.
    expect(new Set(Array.from(sessions.values()).map((session) => session.customer))).toEqual(new Set([winner]))
    const open = Array.from(sessions.values()).filter((session) => session.status === 'open')
    expect(open).toHaveLength(1)
    expect(results.map((result) => (result.kind === 'redirect' ? result.url : null))).toContain(open[0].url)
  })
})
