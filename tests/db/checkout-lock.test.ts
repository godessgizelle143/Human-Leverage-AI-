import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { supabaseCheckoutLock } from '@/lib/stripe/billing-store'
import { startCheckout, type CheckoutGateway, type OpenSession } from '@/lib/stripe/checkout'
import type { Database } from '@/types/database'
import { createTestDb, newMigrations, seedUser, uuid, type TestDb } from './harness'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

async function acquire(userId: string, token: string, leaseSeconds = 30) {
  await t.asService()
  return (await t.one<{ ok: boolean }>('select public.acquire_checkout_lock($1, $2, $3) as ok', [userId, token, leaseSeconds])).ok
}

async function renew(userId: string, token: string, leaseSeconds = 30) {
  await t.asService()
  return (await t.one<{ ok: boolean }>('select public.renew_checkout_lock($1, $2, $3) as ok', [userId, token, leaseSeconds])).ok
}

async function release(userId: string, token: string) {
  await t.asService()
  return (await t.one<{ ok: boolean }>('select public.release_checkout_lock($1, $2) as ok', [userId, token])).ok
}

async function lockRow(userId: string) {
  await t.asSuperuser()
  return t.one<{ token: string; lease_seconds: number }>(
    'select token, round(extract(epoch from expires_at - now()))::int as lease_seconds from public.checkout_locks where user_id = $1',
    [userId],
  )
}

/** Moves the lease into the past, as if the holder had stalled or crashed. */
async function expireLease(userId: string) {
  await t.asSuperuser()
  await t.query(`update public.checkout_locks set expires_at = now() - interval '1 second' where user_id = $1`, [userId])
}

describe('checkout lock functions', () => {
  it('is applied by the checkout lock migration', () => {
    expect(newMigrations().map((migration) => migration.file)).toContain('20261010120000_checkout_locks.sql')
  })

  it('gives the lock to one token at a time per account', async () => {
    const { userId } = await seedUser(t)
    const { userId: otherUser } = await seedUser(t)
    const [first, second] = [uuid(), uuid()]

    expect(await acquire(userId, first)).toBe(true)
    expect(await acquire(userId, second)).toBe(false)
    expect(await acquire(userId, first)).toBe(false) // not re-entrant: a retry cannot extend a lease by acquiring
    expect((await lockRow(userId)).token).toBe(first)
    expect(await acquire(otherUser, second)).toBe(true) // another account is independent
  })

  it('lets only one of many simultaneous acquires succeed', async () => {
    const { userId } = await seedUser(t)
    await t.asService()
    const results = await Promise.all(Array.from({ length: 8 }, () => t.one<{ ok: boolean }>('select public.acquire_checkout_lock($1, $2, 30) as ok', [userId, uuid()])))
    expect(results.filter((result) => result.ok)).toHaveLength(1)
  })

  it('releases only for the holding token', async () => {
    const { userId } = await seedUser(t)
    const [holder, other] = [uuid(), uuid()]
    await acquire(userId, holder)

    expect(await release(userId, other)).toBe(false)
    expect((await lockRow(userId)).token).toBe(holder)
    expect(await release(userId, holder)).toBe(true)
    expect(await lockRow(userId)).toBeUndefined()
    expect(await release(userId, holder)).toBe(false)
    expect(await acquire(userId, other)).toBe(true)
  })

  it('recovers an expired lease, after which the old holder can neither renew nor release', async () => {
    const { userId } = await seedUser(t)
    const [stalled, next] = [uuid(), uuid()]
    await acquire(userId, stalled)
    await expireLease(userId)

    expect(await renew(userId, stalled)).toBe(false) // an expired lease cannot be revived
    expect(await acquire(userId, next)).toBe(true)
    expect(await renew(userId, stalled)).toBe(false)
    expect(await release(userId, stalled)).toBe(false)
    expect((await lockRow(userId)).token).toBe(next)
  })

  it('renews only for the holder and bounds the lease', async () => {
    const { userId } = await seedUser(t)
    const [holder, other] = [uuid(), uuid()]
    await acquire(userId, holder, 5)
    expect((await lockRow(userId)).lease_seconds).toBe(5)

    expect(await renew(userId, other, 30)).toBe(false)
    expect((await lockRow(userId)).lease_seconds).toBe(5)
    expect(await renew(userId, holder, 30)).toBe(true)
    expect((await lockRow(userId)).lease_seconds).toBe(30)

    // No argument can hold an account for more than five minutes or create an already-expired lock.
    expect(await renew(userId, holder, 86400)).toBe(true)
    expect((await lockRow(userId)).lease_seconds).toBe(300)
    expect(await renew(userId, holder, -10)).toBe(true)
    expect((await lockRow(userId)).lease_seconds).toBe(1)
  })

  it('removes the lock with its account', async () => {
    const { userId } = await seedUser(t, { subscription: false })
    await acquire(userId, uuid())
    await t.asSuperuser()
    await t.query('delete from public.interviews where user_id = $1', [userId])
    await t.query('delete from auth.users where id = $1', [userId])
    expect(await lockRow(userId)).toBeUndefined()
  })

  it('is closed to clients: no function or table access for anon or authenticated', async () => {
    const { userId } = await seedUser(t)
    await acquire(userId, uuid())
    await t.asSuperuser()
    const grants = await t.query<{ role: string; fn: string; allowed: boolean }>(
      `select r.role, p.oid::regprocedure::text as fn, has_function_privilege(r.role, p.oid, 'execute') as allowed
       from pg_proc p cross join (values ('anon'), ('authenticated'), ('service_role')) as r(role)
       where p.pronamespace = 'public'::regnamespace and p.proname like '%checkout_lock%'`,
    )
    expect(grants).toHaveLength(12)
    expect(grants.filter((grant) => grant.role !== 'service_role' && grant.allowed)).toEqual([])
    expect(grants.filter((grant) => grant.role === 'service_role' && grant.allowed).map((grant) => grant.fn).sort()).toEqual([
      'acquire_checkout_lock(uuid,uuid,integer)',
      'release_checkout_lock(uuid,uuid)',
      'renew_checkout_lock(uuid,uuid,integer)',
    ])

    await t.asUser(userId)
    await expect(t.query('select public.acquire_checkout_lock($1, $2, 30)', [userId, uuid()])).rejects.toThrow(/permission denied/)
    await expect(t.query('select public.release_checkout_lock($1, $2)', [userId, uuid()])).rejects.toThrow(/permission denied/)
    await expect(t.query('select * from public.checkout_locks')).rejects.toThrow(/permission denied/)
    await expect(t.query('delete from public.checkout_locks')).rejects.toThrow(/permission denied/)
  })

  it('denies every table privilege to anon and authenticated, and every write path to a signed-in user', async () => {
    const { userId } = await seedUser(t)
    const holder = uuid()
    await acquire(userId, holder)
    await t.asSuperuser()
    const granted = await t.query<{ role: string; privilege: string }>(
      `select r.role, p.privilege
       from (values ('anon'), ('authenticated')) as r(role)
       cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) as p(privilege)
       where has_table_privilege(r.role, 'public.checkout_locks', p.privilege)`,
    )
    expect(granted).toEqual([])
    const table = await t.one<{ rls: boolean; policies: number }>(
      `select c.relrowsecurity as rls, (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'checkout_locks') as policies
       from pg_class c where c.oid = 'public.checkout_locks'::regclass`,
    )
    expect(table).toEqual({ rls: true, policies: 0 })

    // The account's own user cannot take, extend, free, or overwrite its lock, let alone another account's.
    for (const role of ['anon', 'authenticated']) {
      await t.asUser(userId)
      await t.db.exec(`set role ${role}`)
      await expect(t.query('select public.acquire_checkout_lock($1, $2, 30)', [userId, uuid()])).rejects.toThrow(/permission denied/)
      await expect(t.query('select public.renew_checkout_lock($1, $2, 30)', [userId, holder])).rejects.toThrow(/permission denied/)
      await expect(t.query('select public.release_checkout_lock($1, $2)', [userId, holder])).rejects.toThrow(/permission denied/)
      await expect(t.query('select public.checkout_lock_lease(30)')).rejects.toThrow(/permission denied/)
      await expect(t.query('insert into public.checkout_locks (user_id, token, expires_at) values ($1, $2, now())', [userId, uuid()])).rejects.toThrow(/permission denied/)
      await expect(t.query(`update public.checkout_locks set expires_at = now() - interval '1 hour'`)).rejects.toThrow(/permission denied/)
      await expect(t.query('truncate public.checkout_locks')).rejects.toThrow(/permission denied/)
    }
    expect((await lockRow(userId)).token).toBe(holder)
  })

  it('runs the lock functions as security definer with a pinned search path', async () => {
    await t.asSuperuser()
    const functions = await t.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname like '%checkout_lock%' order by proname`,
    )
    expect(functions).toEqual([
      { proname: 'acquire_checkout_lock', prosecdef: true, proconfig: ['search_path=public, pg_temp'] },
      { proname: 'checkout_lock_lease', prosecdef: false, proconfig: ['search_path=public, pg_temp'] },
      { proname: 'release_checkout_lock', prosecdef: true, proconfig: ['search_path=public, pg_temp'] },
      { proname: 'renew_checkout_lock', prosecdef: true, proconfig: ['search_path=public, pg_temp'] },
    ])
  })
})

/**
 * Supabase projects grant new tables and functions in `public` to anon and
 * authenticated through default privileges, which the baseline fixture does not
 * set up. This applies the migrations to a database that has such defaults, to
 * check that the migration's own revokes are what closes the lock. It imitates
 * that configuration; it is not a Supabase project.
 */
describe('checkout lock privileges with Supabase-style default grants', () => {
  it('still leaves anon and authenticated without table or function access', async () => {
    const db = new PGlite()
    await db.exec(readFileSync(fileURLToPath(new URL('./supabase-baseline.sql', import.meta.url)), 'utf8'))
    await db.exec(`
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    `)
    for (const migration of newMigrations()) await db.exec(migration.sql)

    // The defaults are in effect: an unrelated new table is open to clients.
    await db.exec('create table public.default_grant_probe (id int)')
    const probe = await db.query<{ open: boolean }>(`select has_table_privilege('authenticated', 'public.default_grant_probe', 'select') as open`)
    expect(probe.rows[0].open).toBe(true)

    const tableGrants = await db.query<{ role: string; privilege: string }>(
      `select r.role, p.privilege
       from (values ('anon'), ('authenticated')) as r(role)
       cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) as p(privilege)
       where has_table_privilege(r.role, 'public.checkout_locks', p.privilege)`,
    )
    expect(tableGrants.rows).toEqual([])

    const functionGrants = await db.query<{ role: string; fn: string }>(
      `select r.role, p.proname as fn
       from pg_proc p cross join (values ('anon'), ('authenticated')) as r(role)
       where p.pronamespace = 'public'::regnamespace and p.proname like '%checkout_lock%' and has_function_privilege(r.role, p.oid, 'execute')`,
    )
    expect(functionGrants.rows).toEqual([])

    const serviceGrants = await db.query<{ fn: string }>(
      `select p.proname as fn from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname like '%checkout_lock%' and has_function_privilege('service_role', p.oid, 'execute')
       order by 1`,
    )
    expect(serviceGrants.rows.map((row) => row.fn)).toEqual(expect.arrayContaining(['acquire_checkout_lock', 'release_checkout_lock', 'renew_checkout_lock']))

    await db.exec('set role authenticated')
    await expect(db.query('select public.acquire_checkout_lock($1, $2, 30)', [uuid(), uuid()])).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from public.checkout_locks')).rejects.toThrow(/permission denied/)
    await db.close()
  })
})

/** The slice of the Supabase client that supabaseCheckoutLock uses, answered by the migrated database as service_role. */
function serviceClient() {
  const client = {
    async rpc(fn: string, args: Record<string, unknown>) {
      try {
        await t.asService()
        const names = Object.keys(args)
        const row = await t.one<{ result: unknown }>(`select public.${fn}(${names.map((name, index) => `${name} => $${index + 1}`).join(', ')}) as result`, Object.values(args))
        return { data: row.result, error: null }
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
      }
    },
  }
  return client as unknown as SupabaseClient<Database>
}

function fakeStripe() {
  let nextId = 1
  const sessions = new Map<string, OpenSession & { status: 'open' | 'expired' }>()
  const gateway: CheckoutGateway = {
    async createCustomer() { return 'cus_1' },
    async deleteCustomer() {},
    async listSubscriptionStatuses() { return [] },
    async listOpenSessions() {
      return Array.from(sessions.values()).filter((session) => session.status === 'open').map(({ id, created, url }) => ({ id, created, url }))
    },
    async createSession() {
      const id = `cs_${nextId}`
      const session = { id, created: nextId++, url: `https://checkout.stripe.test/${id}`, status: 'open' as const }
      sessions.set(id, session)
      return { id: session.id, created: session.created, url: session.url }
    },
    async retrieveSession(id) {
      const session = sessions.get(id)
      return session ? { id: session.id, customerId: 'cus_1', status: session.status, url: session.url, expiresAt: null } : null
    },
    async expireSession(id) { sessions.get(id)!.status = 'expired' },
  }
  return { gateway, sessions, openUrls: () => Array.from(sessions.values()).filter((session) => session.status === 'open').map((session) => session.url) }
}

describe('startCheckout over the database lock', () => {
  const claims = { claim: async () => 'cus_1' }

  /** Request A holds the database lock and is paused after reading the open sessions. */
  async function pausedRequest(userId: string, stripe: ReturnType<typeof fakeStripe>, timing: { wait?: () => Promise<void> } = {}) {
    const list = stripe.gateway.listOpenSessions
    let first = true
    let resume!: () => void
    let signalReached!: () => void
    const reached = new Promise<void>((resolve) => { signalReached = resolve })
    const gate = new Promise<void>((resolve) => { resume = resolve })
    stripe.gateway.listOpenSessions = async (customer) => {
      const sessions = await list(customer)
      if (first) {
        first = false
        signalReached()
        await gate
      }
      return sessions
    }
    const deps = { gateway: stripe.gateway, claims, lock: supabaseCheckoutLock(serviceClient()), timing }
    const input = { userId, email: null, customerId: 'cus_1' }
    const result = startCheckout(deps, input)
    await reached
    return { result, resume, start: () => startCheckout(deps, input) }
  }

  it('serializes two requests for one account and leaves no lock behind', async () => {
    const { userId } = await seedUser(t)
    const stripe = fakeStripe()
    let signalWaiting!: () => void
    let letBRetry!: () => void
    const bWaiting = new Promise<void>((resolve) => { signalWaiting = resolve })
    const retryGate = new Promise<void>((resolve) => { letBRetry = resolve })
    const a = await pausedRequest(userId, stripe, { wait: async () => { signalWaiting(); await retryGate } })

    const requestB = a.start()
    await bWaiting
    expect(Array.from(stripe.sessions.keys())).toEqual(['cs_1']) // B is waiting on the database lock

    a.resume()
    await expect(a.result).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' })
    expect(stripe.openUrls()).toEqual(['https://checkout.stripe.test/cs_1'])

    letBRetry()
    await expect(requestB).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(stripe.openUrls()).toEqual(['https://checkout.stripe.test/cs_2'])
    expect(await lockRow(userId)).toBeUndefined()
  })

  it('lets a later request take over an expired lease; the stalled request returns no URL', async () => {
    const { userId } = await seedUser(t)
    const stripe = fakeStripe()
    const a = await pausedRequest(userId, stripe)
    await expireLease(userId)

    await expect(a.start()).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    const laterHolder = uuid()
    expect(await acquire(userId, laterHolder)).toBe(true)

    // A's own clock still considers its lease live, so only the database can tell it the lock is gone.
    a.resume()
    await expect(a.result).resolves.toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_1' })
    expect(stripe.openUrls()).toEqual(['https://checkout.stripe.test/cs_2'])
    expect((await lockRow(userId)).token).toBe(laterHolder) // A's release left the later holder's lock alone
  })

  it('does not expire the new holder\'s session when the stalled request lists sessions after the takeover', async () => {
    const { userId } = await seedUser(t)
    const stripe = fakeStripe()
    const list = stripe.gateway.listOpenSessions
    let first = true
    let send!: () => void
    let signalHeld!: () => void
    const held = new Promise<void>((resolve) => { signalHeld = resolve })
    const gate = new Promise<void>((resolve) => { send = resolve })
    stripe.gateway.listOpenSessions = async (customer) => {
      if (first) {
        first = false
        signalHeld()
        await gate // the call stalls before it reaches Stripe
      }
      return list(customer)
    }
    const deps = { gateway: stripe.gateway, claims, lock: supabaseCheckoutLock(serviceClient()) }
    const input = { userId, email: null, customerId: 'cus_1' }

    const requestA = startCheckout(deps, input)
    await held
    await expireLease(userId)
    await expect(startCheckout(deps, input)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })

    send() // A now lists [cs_2]; the database refuses its renewal, so it expires nothing
    await expect(requestA).resolves.toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_1' })
    expect(stripe.openUrls()).toEqual(['https://checkout.stripe.test/cs_2'])
    expect(await lockRow(userId)).toBeUndefined()
  })

  it('fails closed when the lock functions are unavailable', async () => {
    const stripe = fakeStripe()
    const broken = { rpc: async () => ({ data: null, error: { message: 'function public.acquire_checkout_lock does not exist' } }) } as unknown as SupabaseClient<Database>
    await expect(startCheckout({ gateway: stripe.gateway, claims, lock: supabaseCheckoutLock(broken) }, { userId: uuid(), email: null, customerId: 'cus_1' })).rejects.toThrow(/Checkout lock acquire failed/)
    expect(stripe.sessions.size).toBe(0)
  })
})
