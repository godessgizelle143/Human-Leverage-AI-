import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blockingSubscription, CHECKOUT_STRIPE_REQUEST, CHECKOUT_TIMING, chooseKeeperSession, sessionProblem, startCheckout, STRIPE_CALL_BUDGET_MS, type CheckoutGateway, type CheckoutLock, type CustomerClaim, type OpenSession, type SessionState } from '@/lib/stripe/checkout'
import { STRIPE_SDK_VERSION_FOR_BUDGET } from '@/lib/stripe/limits'

/**
 * A fake Stripe account: customers, subscriptions, and Checkout Sessions.
 * `pay` completes a session the way Stripe does (it stops being open and its
 * subscription exists); `failExpiry` makes expiring a session fail while it
 * stays open, like a transient API error.
 */
function fakeStripe(options: { subscriptions?: Stripe.Subscription.Status[]; sameSecond?: boolean; sessionIds?: string[] } = {}) {
  let clock = 1000
  let nextId = 1
  const customers = new Set<string>()
  const deleted: string[] = []
  const subscriptions = [...(options.subscriptions ?? [])]
  const failingExpiry = new Set<string>()
  const expireCalls: string[] = []
  const sessions = new Map<string, OpenSession & { customer: string; status: 'open' | 'expired' | 'complete'; expiresAt: number | null }>()
  const gateway: CheckoutGateway = {
    async createCustomer() { const id = `cus_${nextId++}`; customers.add(id); return id },
    async deleteCustomer(id) { customers.delete(id); deleted.push(id) },
    async listSubscriptionStatuses() { return [...subscriptions] },
    async listOpenSessions(customer) {
      return Array.from(sessions.values()).filter((s) => s.customer === customer && s.status === 'open').map(({ id, created, url }) => ({ id, created, url }))
    },
    async createSession(customer) {
      const id = options.sessionIds?.shift() ?? `cs_${nextId++}`
      const session = { id, created: options.sameSecond ? clock : clock++, url: `https://checkout.stripe.test/${id}`, customer, status: 'open' as const, expiresAt: null }
      sessions.set(id, session)
      return { id: session.id, created: session.created, url: session.url }
    },
    async retrieveSession(id) {
      const session = sessions.get(id)
      return session ? { id: session.id, customerId: session.customer, status: session.status, url: session.url, expiresAt: session.expiresAt } : null
    },
    async expireSession(id) {
      expireCalls.push(id)
      const session = sessions.get(id)!
      if (session.status !== 'open') throw new Error(`Session ${id} is ${session.status}`)
      if (failingExpiry.has(id)) throw new Error('Stripe API temporarily unavailable')
      session.status = 'expired'
    },
  }
  return {
    gateway,
    sessions,
    customers,
    deleted,
    expireCalls,
    open: () => Array.from(sessions.values()).filter((s) => s.status === 'open'),
    pay(id: string) { sessions.get(id)!.status = 'complete'; subscriptions.push('active') },
    /** Expires a session outside any request, like Stripe's own expiry or the dashboard. */
    expireExternally(id: string) { sessions.get(id)!.status = 'expired' },
    failExpiry: (id: string) => failingExpiry.add(id),
  }
}

/** Same first-writer-wins semantics as supabaseCustomerClaim. */
function memoryClaims(initial: string | null = null): CustomerClaim & { stored: () => string | null } {
  let stored = initial
  return {
    async claim(_userId, customerId) { stored ??= customerId; return stored },
    stored: () => stored,
  }
}

/**
 * Same semantics as the checkout_locks functions (tests/db/checkout-lock.test.ts
 * covers the real ones): one unexpired holder per account, takeover only after
 * the lease runs out, renew and release only by the holding token. `clock.now`
 * stands in for the database clock, in milliseconds.
 */
function memoryLock() {
  const clock = { now: 0 }
  const held = new Map<string, { token: string; expiresAt: number }>()
  const lock: CheckoutLock = {
    async acquire(userId, token, leaseSeconds) {
      const current = held.get(userId)
      if (current && current.expiresAt > clock.now) return false
      held.set(userId, { token, expiresAt: clock.now + leaseSeconds * 1000 })
      return true
    },
    async renew(userId, token, leaseSeconds) {
      const current = held.get(userId)
      if (!current || current.token !== token || current.expiresAt <= clock.now) return false
      current.expiresAt = clock.now + leaseSeconds * 1000
      return true
    },
    async release(userId, token) {
      if (held.get(userId)?.token === token) held.delete(userId)
    },
  }
  return { ...lock, clock, held, holder: (userId = 'user-1') => held.get(userId)?.token ?? null }
}

/** Pauses the first request inside its critical section, right after it has read the open sessions. */
function pauseFirstSnapshot(stripe: ReturnType<typeof fakeStripe>) {
  const originalList = stripe.gateway.listOpenSessions
  let callCount = 0
  let resume!: () => void
  let signalReached!: () => void
  let snapshot: OpenSession[] = []
  const reached = new Promise<void>((resolve) => { signalReached = resolve })
  const gate = new Promise<void>((resolve) => { resume = resolve })
  stripe.gateway.listOpenSessions = async (customer) => {
    const sessions = await originalList(customer)
    callCount += 1
    if (callCount === 1) {
      snapshot = sessions
      signalReached()
      await gate
    }
    return sessions
  }
  return { reached, resume, snapshot: () => snapshot }
}

const urlsOf = (sessions: { url: string | null }[]) => sessions.map((session) => session.url)

const STRIPE_CALLS = ['listSubscriptionStatuses', 'createSession', 'listOpenSessions', 'expireSession', 'retrieveSession'] as const

/** Wraps a gateway and a lock so that every Stripe call and every lock call is recorded in the order it started. */
function recorded(gateway: CheckoutGateway, lockUnderTest: CheckoutLock) {
  const order: string[] = []
  const wrappedGateway = { ...gateway }
  for (const method of STRIPE_CALLS) {
    const original = gateway[method] as (argument: string) => Promise<unknown>
    wrappedGateway[method] = (async (argument: string) => { order.push(method); return original(argument) }) as never
  }
  const wrappedLock: CheckoutLock = {
    acquire: async (...args) => { order.push('acquire'); return lockUnderTest.acquire(...args) },
    renew: async (...args) => { order.push('renew'); return lockUnderTest.renew(...args) },
    release: async (...args) => { order.push('release'); return lockUnderTest.release(...args) },
  }
  return { gateway: wrappedGateway, lock: wrappedLock, order }
}

/**
 * The Stripe calls that did not start directly after a successful acquire or
 * renew. Expiries sent together in one sweep share the renewal before the first.
 */
function callsWithoutOwnershipCheck(order: string[]) {
  return order.flatMap((entry, index) => {
    if (!(STRIPE_CALLS as readonly string[]).includes(entry)) return []
    const previous = order[index - 1]
    const inSameSweep = entry === 'expireSession' && previous === 'expireSession'
    return previous === 'acquire' || previous === 'renew' || inSameSweep ? [] : [`${entry} after ${previous}`]
  })
}

let lock: ReturnType<typeof memoryLock>

beforeEach(() => {
  lock = memoryLock()
})

const input = { userId: 'user-1', email: 'a@example.com', customerId: null }

describe('startCheckout', () => {
  it('leaves concurrent requests with one customer and exactly one payable session', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims()
    const results = await Promise.all([1, 2, 3].map(() => startCheckout({ gateway: stripe.gateway, claims, lock }, input)))

    expect(stripe.customers.size).toBe(1)
    expect(stripe.deleted).toHaveLength(2)
    // Every other session is expired, so only one can ever be paid; a request
    // that returned an expired URL lands on Stripe's expired page and retries.
    expect(stripe.open()).toHaveLength(1)
    expect(results.map((result) => (result.kind === 'redirect' ? result.url : null))).toContain(stripe.open()[0].url)
  })

  // The original race: request A reads the open sessions and pauses; request B
  // creates cs_2, expires cs_1, and returns cs_2; A resumes with its stale
  // snapshot and must not return the URL of the expired cs_1.
  //
  // This test used to let B run to completion while A was paused holding a
  // live lock, and expected both requests to redirect to different sessions
  // that were both still open. Under the checkout lock that ordering cannot
  // happen: B is refused the lock until A finishes or A's lease runs out, and
  // two open sessions handed out for one account is what the lock prevents.
  // The setup now uses the ordering the lock does allow: A's lease runs out
  // while it is paused, and B takes the lock over. B is in turn held just
  // before it returns, so A resumes while B still owns the lock.
  it('reproduces a stale-session URL when concurrent requests see different snapshots', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    const originalList = stripe.gateway.listOpenSessions
    let callCount = 0
    let staleSnapshot: OpenSession[] = []
    let releaseFirst!: () => void
    let signalFirstSnapshot!: () => void
    let releaseSecond!: () => void
    let signalSecondHoldsLock!: () => void

    const firstSnapshotReady = new Promise<void>((resolve) => {
      signalFirstSnapshot = resolve
    })
    const allowFirstToContinue = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const secondHoldsLock = new Promise<void>((resolve) => {
      signalSecondHoldsLock = resolve
    })
    const allowSecondToContinue = new Promise<void>((resolve) => {
      releaseSecond = resolve
    })

    stripe.gateway.listOpenSessions = async (customer) => {
      const snapshot = await originalList(customer)
      callCount += 1
      if (callCount === 1) {
        // A's list, read while only cs_1 exists.
        staleSnapshot = snapshot
        signalFirstSnapshot()
        await allowFirstToContinue
      }
      return snapshot
    }

    // B is held at its verification of cs_2, after it has created cs_2 and
    // expired cs_1 and before it returns. A is paused before it gets this far,
    // so the first verification is B's.
    const originalRetrieve = stripe.gateway.retrieveSession
    let retrieveCount = 0
    stripe.gateway.retrieveSession = async (sessionId) => {
      retrieveCount += 1
      if (retrieveCount === 1) {
        signalSecondHoldsLock()
        await allowSecondToContinue
      }
      return originalRetrieve(sessionId)
    }

    const deps = { gateway: stripe.gateway, claims, lock, timing: { now: () => lock.clock.now } }
    const requestA = startCheckout(deps, { ...input, customerId: 'cus_existing' })
    await firstSnapshotReady
    const tokenA = lock.holder()
    expect(tokenA).not.toBeNull() // A holds the lock while it is paused

    lock.clock.now = CHECKOUT_TIMING.leaseSeconds * 1000 // A's lease runs out
    const requestB = startCheckout(deps, { ...input, customerId: 'cus_existing' })
    await secondHoldsLock
    const tokenB = lock.holder()

    // B took the lock over, created the replacement session, and expired the old one.
    expect(tokenB).not.toBeNull()
    expect(tokenB).not.toBe(tokenA)
    expect(stripe.sessions.get('cs_1')?.status).toBe('expired')
    expect(stripe.sessions.get('cs_2')?.status).toBe('open')
    expect(stripe.expireCalls).toEqual(['cs_1'])

    releaseFirst()
    const resultA = await requestA

    // A resumed with a snapshot that still listed cs_1, and returned no checkout URL.
    expect(staleSnapshot.map((session) => session.id)).toEqual(['cs_1'])
    expect(resultA.kind).not.toBe('redirect')
    expect(resultA).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    // After losing the lock A expired nothing of B's and did not release B's lock.
    expect(stripe.expireCalls).toEqual(['cs_1'])
    expect(stripe.sessions.get('cs_2')?.status).toBe('open')
    expect(lock.holder()).toBe(tokenB)

    releaseSecond()
    const resultB = await requestB

    expect(resultB.kind).toBe('redirect')
    expect(resultB).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })

    const returned = [resultA, resultB].flatMap((result) => (result.kind === 'redirect' ? [result.url] : []))
    expect(returned).not.toContain('https://checkout.stripe.test/cs_1') // the expired session is never returned
    expect(stripe.open().map((session) => session.url)).toContain(resultB.kind === 'redirect' ? resultB.url : null)
    expect(stripe.open().map((session) => session.url)).toEqual(returned)
    expect(lock.holder()).toBeNull() // B released its own lock
  })

  // The same race as the test above, with B finished before A resumes: B has
  // already returned cs_2 and released the lock when A continues with a
  // snapshot that still lists cs_1 as open.
  it('returns no URL for the session another request expired while this one was stalled past its lease', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    const originalList = stripe.gateway.listOpenSessions
    let callCount = 0
    let staleSnapshot: OpenSession[] = []
    let releaseFirst!: () => void
    let signalFirstSnapshot!: () => void

    const firstSnapshotReady = new Promise<void>((resolve) => {
      signalFirstSnapshot = resolve
    })
    const allowFirstToContinue = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    stripe.gateway.listOpenSessions = async (customer) => {
      const snapshot = await originalList(customer)
      callCount += 1
      if (callCount === 1) {
        staleSnapshot = snapshot
        signalFirstSnapshot()
        await allowFirstToContinue
      }
      return snapshot
    }

    const deps = { gateway: stripe.gateway, claims, lock, timing: { now: () => lock.clock.now } }
    const requestA = startCheckout(deps, { ...input, customerId: 'cus_existing' })
    await firstSnapshotReady
    const tokenA = lock.holder()

    lock.clock.now = CHECKOUT_TIMING.leaseSeconds * 1000 // A's lease runs out while it is paused
    const resultB = await startCheckout(deps, { ...input, customerId: 'cus_existing' })

    // B ran inside the critical section only after taking the lock over from A.
    expect(tokenA).not.toBeNull()
    expect(resultB).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(stripe.sessions.get('cs_1')?.status).toBe('expired')

    releaseFirst()
    const resultA = await requestA

    // A resumed with the stale snapshot and did not return the expired cs_1.
    expect(staleSnapshot.map((session) => session.id)).toEqual(['cs_1'])
    expect(resultA).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(stripe.expireCalls).toEqual(['cs_1']) // B's sweep only; A changed nothing after losing the lock

    // Every URL that was returned is still payable, and it is the only open session.
    const returned = [resultA, resultB].flatMap((result) => (result.kind === 'redirect' ? [result.url] : []))
    expect(stripe.open().map((session) => session.url)).toEqual(returned)
    expect(returned).toEqual(['https://checkout.stripe.test/cs_2'])
  })

  it('expires an abandoned earlier session when the user retries', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims()
    const first = await startCheckout({ gateway: stripe.gateway, claims, lock }, input)
    const second = await startCheckout({ gateway: stripe.gateway, claims, lock }, { ...input, customerId: claims.stored() })
    expect(first).not.toEqual(second)
    expect(stripe.open()).toHaveLength(1)
    expect(second).toEqual({ kind: 'redirect', url: stripe.open()[0].url })
  })

  it('refuses checkout while Stripe already has a live subscription, even before the webhook ran', async () => {
    for (const status of ['active', 'trialing'] as const) {
      const stripe = fakeStripe({ subscriptions: ['canceled', status] })
      await expect(startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_x'), lock }, { ...input, customerId: 'cus_x' })).resolves.toEqual({ kind: 'blocked', reason: 'already-subscribed' })
      expect(stripe.sessions.size).toBe(0)
    }
  })

  it('sends a past-due customer to fix payment instead of starting a second subscription', async () => {
    const stripe = fakeStripe({ subscriptions: ['past_due'] })
    await expect(startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_x'), lock }, { ...input, customerId: 'cus_x' })).resolves.toEqual({ kind: 'blocked', reason: 'payment-required' })
  })

  it('returns no checkout URL when an older session cannot be expired and is still payable', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims()
    await startCheckout({ gateway: stripe.gateway, claims, lock }, input) // cs_2, the earlier attempt
    stripe.failExpiry('cs_2')

    const result = await startCheckout({ gateway: stripe.gateway, claims, lock }, { ...input, customerId: claims.stored() })

    expect(result).toMatchObject({ kind: 'cleanup_failed', stillOpen: ['cs_2'], failures: [{ sessionId: 'cs_2', message: 'Stripe API temporarily unavailable' }] })
    expect(result.kind).not.toBe('redirect')
    // The session created by this request is never handed out and is expired too.
    expect(stripe.open().map((session) => session.id)).toEqual(['cs_2'])
  })

  it('blocks instead of redirecting when the older session was paid while this request ran', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims()
    await startCheckout({ gateway: stripe.gateway, claims, lock }, input) // cs_2
    const create = stripe.gateway.createSession
    stripe.gateway.createSession = async (customer) => {
      const session = await create(customer)
      stripe.pay('cs_2') // the user finishes paying the earlier session in another tab
      return session
    }

    await expect(startCheckout({ gateway: stripe.gateway, claims, lock }, { ...input, customerId: claims.stored() })).resolves.toEqual({ kind: 'blocked', reason: 'already-subscribed' })
    expect(stripe.open()).toEqual([]) // this request's own session was not left payable
  })

  it('still redirects when every older session is expired successfully', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims()
    await startCheckout({ gateway: stripe.gateway, claims, lock }, input)
    const result = await startCheckout({ gateway: stripe.gateway, claims, lock }, { ...input, customerId: claims.stored() })
    expect(result).toEqual({ kind: 'redirect', url: stripe.open()[0].url })
    expect(stripe.expireCalls).toEqual(['cs_2'])
  })

  it('is unavailable when the account has no row to claim a customer on', async () => {
    const stripe = fakeStripe()
    const claims: CustomerClaim = { claim: async () => null }
    await expect(startCheckout({ gateway: stripe.gateway, claims, lock }, input)).resolves.toEqual({ kind: 'unavailable' })
    expect(stripe.sessions.size).toBe(0)
  })
})

describe('startCheckout concurrency', () => {
  const existing = { ...input, customerId: 'cus_existing' }

  // The original race: request A reads the open sessions and pauses; request B
  // creates cs_2, expires cs_1, and returns cs_2; A resumes with its stale
  // snapshot. A lock that never excludes anyone reproduces that interleaving
  // exactly, and A must still not return the URL of the expired cs_1.
  it('never returns the expired session when two requests interleave on a stale snapshot', async () => {
    const stripe = fakeStripe()
    const noExclusion: CheckoutLock = { acquire: async () => true, renew: async () => true, release: async () => undefined }
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock: noExclusion }
    const paused = pauseFirstSnapshot(stripe)

    const requestA = startCheckout(deps, existing)
    await paused.reached
    const resultB = await startCheckout(deps, existing)
    paused.resume()
    const resultA = await requestA

    // The race happened: A's snapshot holds only cs_1, which B has expired.
    expect(paused.snapshot().map((session) => session.id)).toEqual(['cs_1'])
    expect(stripe.sessions.get('cs_1')?.status).toBe('expired')

    expect(resultB).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(resultA).toEqual({ kind: 'contended', reason: 'session-stale', customerId: 'cus_existing', problem: 'not-open' })
    expect(urlsOf(stripe.open())).toEqual(['https://checkout.stripe.test/cs_2'])
  })

  it('makes a second request wait for the lock, so no request acts on a stale snapshot', async () => {
    const stripe = fakeStripe()
    const paused = pauseFirstSnapshot(stripe)
    let signalWaiting!: () => void
    let letBRetry!: () => void
    const bWaiting = new Promise<void>((resolve) => { signalWaiting = resolve })
    const retryGate = new Promise<void>((resolve) => { letBRetry = resolve })
    const wait = vi.fn(async () => { signalWaiting(); await retryGate })
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { wait } }

    const requestA = startCheckout(deps, existing)
    await paused.reached
    const requestB = startCheckout(deps, existing)
    await bWaiting

    // B is excluded while A is inside its critical section: it has created and expired nothing.
    expect(Array.from(stripe.sessions.keys())).toEqual(['cs_1'])
    expect(stripe.expireCalls).toEqual([])

    paused.resume()
    const resultA = await requestA
    // A's URL is a payable session at the moment it is returned.
    expect(resultA).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' })
    expect(urlsOf(stripe.open())).toEqual(['https://checkout.stripe.test/cs_1'])
    expect(lock.holder()).toBeNull()

    letBRetry()
    const resultB = await requestB
    expect(resultB).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(urlsOf(stripe.open())).toEqual(['https://checkout.stripe.test/cs_2'])
    expect(wait).toHaveBeenCalledTimes(1)
    expect(wait).toHaveBeenCalledWith(CHECKOUT_TIMING.retryDelayMs)
    expect(lock.holder()).toBeNull()
  })

  it('recovers the lock from a stalled holder, which then changes and returns nothing', async () => {
    const stripe = fakeStripe()
    const paused = pauseFirstSnapshot(stripe)
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { now: () => lock.clock.now } }

    const requestA = startCheckout(deps, existing)
    await paused.reached
    lock.clock.now = CHECKOUT_TIMING.leaseSeconds * 1000 + 1 // A stalls past its lease

    const resultB = await startCheckout(deps, existing)
    expect(resultB).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(await lock.acquire('user-1', 'request-c', 30)).toBe(true) // a later request now holds the lock

    paused.resume()
    const resultA = await requestA

    expect(resultA).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(stripe.expireCalls).toEqual(['cs_1']) // only B's sweep; A expired nothing after losing the lock
    expect(urlsOf(stripe.open())).toEqual(['https://checkout.stripe.test/cs_2'])
    expect(lock.holder()).toBe('request-c') // A's release did not free someone else's lock
  })

  it('does not return a URL when the lock was taken over, even if its own clock says the lease is live', async () => {
    const stripe = fakeStripe()
    const paused = pauseFirstSnapshot(stripe)
    const requestA = startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }, existing)
    await paused.reached
    lock.held.set('user-1', { token: 'other-request', expiresAt: 30_000 })
    paused.resume()

    await expect(requestA).resolves.toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(lock.holder()).toBe('other-request')
  })

  it('does not create a session once its lease has run out', async () => {
    const stripe = fakeStripe()
    const listStatuses = stripe.gateway.listSubscriptionStatuses
    stripe.gateway.listSubscriptionStatuses = async (customer) => {
      lock.clock.now = CHECKOUT_TIMING.leaseSeconds * 1000 // Stripe took the whole lease to answer
      return listStatuses(customer)
    }
    const result = await startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { now: () => lock.clock.now } }, existing)
    expect(result).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(stripe.sessions.size).toBe(0)
  })

  it('does not return a session that stopped being open while the lock was held', async () => {
    const stripe = fakeStripe()
    const listStatuses = stripe.gateway.listSubscriptionStatuses
    let calls = 0
    stripe.gateway.listSubscriptionStatuses = async (customer) => {
      if (++calls === 2) stripe.expireExternally('cs_1') // after the sweep, before the URL is returned
      return listStatuses(customer)
    }
    const result = await startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }, existing)
    expect(result).toEqual({ kind: 'contended', reason: 'session-stale', customerId: 'cus_existing', problem: 'not-open' })
    expect(lock.holder()).toBeNull()
  })

  it('gives up after a bounded wait while another request holds the lock, creating nothing', async () => {
    const stripe = fakeStripe()
    await lock.acquire('user-1', 'other-request', 30)
    const wait = vi.fn(async () => undefined)
    const result = await startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { wait, acquireAttempts: 4 } }, existing)

    expect(result).toEqual({ kind: 'contended', reason: 'lock-busy', customerId: 'cus_existing' })
    expect(wait).toHaveBeenCalledTimes(3)
    expect(stripe.sessions.size).toBe(0)
    expect(lock.holder()).toBe('other-request')
  })

  it('locks per account, so different accounts do not wait for each other', async () => {
    const stripe = fakeStripe()
    await lock.acquire('user-2', 'other-account', 30)
    const wait = vi.fn(async () => undefined)
    const result = await startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { wait } }, existing)
    expect(result.kind).toBe('redirect')
    expect(wait).not.toHaveBeenCalled()
    expect(lock.holder('user-2')).toBe('other-account')
  })

  it('releases the lock on every outcome, including a Stripe error', async () => {
    const blocked = fakeStripe({ subscriptions: ['active'] })
    await startCheckout({ gateway: blocked.gateway, claims: memoryClaims('cus_existing'), lock }, existing)
    expect(lock.holder()).toBeNull()

    const failing = fakeStripe()
    failing.gateway.createSession = async () => { throw new Error('Stripe is down') }
    await expect(startCheckout({ gateway: failing.gateway, claims: memoryClaims('cus_existing'), lock }, existing)).rejects.toThrow('Stripe is down')
    expect(lock.holder()).toBeNull()

    const cleanup = fakeStripe()
    await startCheckout({ gateway: cleanup.gateway, claims: memoryClaims('cus_existing'), lock }, existing)
    cleanup.failExpiry('cs_1')
    await expect(startCheckout({ gateway: cleanup.gateway, claims: memoryClaims('cus_existing'), lock }, existing)).resolves.toMatchObject({ kind: 'cleanup_failed' })
    expect(lock.holder()).toBeNull()
  })

  it('fails closed when the lock cannot be acquired or confirmed', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    const acquireFails: CheckoutLock = { ...lock, acquire: async () => { throw new Error('database unreachable') } }
    await expect(startCheckout({ gateway: stripe.gateway, claims, lock: acquireFails }, existing)).rejects.toThrow('database unreachable')
    expect(stripe.sessions.size).toBe(0)

    const renewFails: CheckoutLock = { ...lock, renew: async () => { throw new Error('database unreachable') } }
    await expect(startCheckout({ gateway: stripe.gateway, claims, lock: renewFails }, existing)).rejects.toThrow('database unreachable')
    expect(lock.holder()).toBeNull() // still released
  })

  it('keeps the result when releasing the lock fails; the lease recovers it', async () => {
    const stripe = fakeStripe()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const releaseFails: CheckoutLock = { ...lock, release: async () => { throw new Error('database unreachable') } }
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), timing: { now: () => lock.clock.now, wait: async () => { lock.clock.now += 10_000 } } }

    await expect(startCheckout({ ...deps, lock: releaseFails }, existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' })
    expect(logged).toHaveBeenCalledWith('Checkout lock could not be released:', 'user-1', 'database unreachable')
    expect(lock.holder()).not.toBeNull()

    // The next request waits out the abandoned lease instead of being locked out.
    await expect(startCheckout({ ...deps, lock }, existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    logged.mockRestore()
  })
  /** Holds one gateway call, before it reaches Stripe, until the test lets it through. */
  function holdCall<K extends 'createSession' | 'listOpenSessions' | 'expireSession' | 'listSubscriptionStatuses' | 'retrieveSession'>(stripe: ReturnType<typeof fakeStripe>, method: K, nth = 1) {
    const original = stripe.gateway[method] as (argument: string) => Promise<unknown>
    let calls = 0
    let send!: () => void
    let signalHeld!: () => void
    const held = new Promise<void>((resolve) => { signalHeld = resolve })
    const gate = new Promise<void>((resolve) => { send = resolve })
    stripe.gateway[method] = (async (argument: string) => {
      if (++calls === nth) {
        signalHeld()
        await gate
      }
      return original(argument)
    }) as CheckoutGateway[K]
    return { held, send }
  }

  const expireLease = () => { lock.clock.now += CHECKOUT_TIMING.leaseSeconds * 1000 + 1 }
  const cs = (id: string) => `https://checkout.stripe.test/${id}`
  const lostLock = { kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' }

  it('renews the lock in the database before every Stripe call and again before returning a URL', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    await startCheckout({ gateway: stripe.gateway, claims, lock }, existing) // cs_1, for the next request to expire

    const run = recorded(stripe.gateway, lock)
    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).resolves.toEqual({ kind: 'redirect', url: cs('cs_2') })
    expect(run.order).toEqual([
      'acquire', 'listSubscriptionStatuses',
      'renew', 'createSession',
      'renew', 'listOpenSessions',
      'renew', 'expireSession',
      'renew', 'listSubscriptionStatuses',
      'renew', 'retrieveSession',
      'renew', // the final ownership check, after the session is verified
      'release',
    ])
    expect(callsWithoutOwnershipCheck(run.order)).toEqual([])
  })

  it('checks ownership before every Stripe call on the blocked, cleanup-failed, verification-failed, and error paths too', async () => {
    const claims = memoryClaims('cus_existing')
    const orders: Record<string, string[]> = {}

    // A subscription appears during the run: the request's own session is discarded.
    const blocked = fakeStripe()
    await startCheckout({ gateway: blocked.gateway, claims, lock }, existing)
    const create = blocked.gateway.createSession
    blocked.gateway.createSession = async (customer) => { const session = await create(customer); blocked.pay('cs_1'); return session }
    let run = recorded(blocked.gateway, lock)
    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).resolves.toEqual({ kind: 'blocked', reason: 'already-subscribed' })
    orders.blocked = run.order

    // An older session cannot be expired: re-list, then discard the request's own session.
    const cleanup = fakeStripe()
    await startCheckout({ gateway: cleanup.gateway, claims, lock }, existing)
    cleanup.failExpiry('cs_1')
    run = recorded(cleanup.gateway, lock)
    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).resolves.toMatchObject({ kind: 'cleanup_failed' })
    orders.cleanupFailed = run.order

    // The created session has no URL when verified: it is discarded after the final check.
    const noUrl = fakeStripe()
    const retrieve = noUrl.gateway.retrieveSession
    noUrl.gateway.retrieveSession = async (id) => ({ ...(await retrieve(id))!, url: null })
    run = recorded(noUrl.gateway, lock)
    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).resolves.toMatchObject({ kind: 'contended', problem: 'no-url' })
    orders.noUrl = run.order

    // Verification throws: the request's own session is discarded on the way out.
    const failing = fakeStripe()
    failing.gateway.retrieveSession = async () => { throw new Error('Request timed out') }
    run = recorded(failing.gateway, lock)
    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).rejects.toThrow('Request timed out')
    orders.error = run.order

    for (const [path, order] of Object.entries(orders)) {
      expect(callsWithoutOwnershipCheck(order), path).toEqual([])
      expect(order.at(-1), path).toBe('release')
    }
    // Each of these paths ends with a discard of the request's own session, itself preceded by a renewal.
    for (const path of ['blocked', 'cleanupFailed', 'noUrl', 'error']) expect(orders[path].slice(-3), path).toEqual(['renew', 'expireSession', 'release'])
  })

  // Losing the lock at any point stops the request: no later Stripe call is made at all.
  it.each(STRIPE_CALLS.map((call) => [call] as const))('makes no further Stripe call once the lock is lost during %s', async (during) => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    await startCheckout({ gateway: stripe.gateway, claims, lock }, existing) // cs_1, so the run includes a sweep
    const run = recorded(stripe.gateway, lock)
    let taken = false
    const original = run.gateway[during] as (argument: string) => Promise<unknown>
    run.gateway[during] = (async (argument: string) => {
      const result = await original(argument)
      if (!taken && (during !== 'listSubscriptionStatuses' || run.order.includes('createSession'))) {
        taken = true
        lock.held.set('user-1', { token: 'other-request', expiresAt: lock.clock.now + 90_000 }) // the lock changes hands mid-call
      }
      return result
    }) as never

    await expect(startCheckout({ gateway: run.gateway, claims, lock: run.lock }, existing)).resolves.toEqual(lostLock)
    const afterLoss = run.order.slice(run.order.lastIndexOf(during) + 1)
    expect(afterLoss).toEqual(['renew', 'release']) // one refused renewal, then only the token-matched release
    expect(lock.holder()).toBe('other-request')
  })

  // Lease takeover while A's list call is still in flight: A's list then
  // includes B's session, and A must not expire it.
  it('does not expire the new holder\'s session when a stalled request lists the sessions after the takeover', async () => {
    const stripe = fakeStripe()
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }
    const aList = holdCall(stripe, 'listOpenSessions')

    const requestA = startCheckout(deps, existing) // creates cs_1, then its list call stalls
    await aList.held
    expireLease()
    const resultB = await startCheckout(deps, existing) // takes over, creates cs_2, expires cs_1
    expect(resultB).toEqual({ kind: 'redirect', url: cs('cs_2') })

    aList.send() // A's list now returns [cs_2]
    await expect(requestA).resolves.toEqual(lostLock)
    expect(stripe.expireCalls).toEqual(['cs_1']) // only B's sweep
    expect(urlsOf(stripe.open())).toEqual([cs('cs_2')]) // the URL B returned is still payable
  })

  // A's expiry call was sent while A held the lock and reaches Stripe after B
  // took over. It can only name sessions A listed before the takeover.
  it('cannot invalidate the new holder\'s URL with an expiry call that reaches Stripe late', async () => {
    const stripe = fakeStripe()
    const claims = memoryClaims('cus_existing')
    await startCheckout({ gateway: stripe.gateway, claims, lock }, existing) // cs_1, an abandoned earlier session
    const deps = { gateway: stripe.gateway, claims, lock }
    const aExpiry = holdCall(stripe, 'expireSession')

    const requestA = startCheckout(deps, existing) // creates cs_2; its expiry of cs_1 stalls
    await aExpiry.held
    expireLease()
    const resultB = await startCheckout(deps, existing) // creates cs_3, expires cs_1 and cs_2
    expect(resultB).toEqual({ kind: 'redirect', url: cs('cs_3') })

    aExpiry.send() // A's late expiry of cs_1 reaches Stripe now
    await expect(requestA).resolves.toEqual(lostLock)
    expect(stripe.expireCalls.filter((id) => id === 'cs_3')).toEqual([]) // nobody ever tried to expire B's session
    expect(urlsOf(stripe.open())).toEqual([cs('cs_3')])
  })

  it('does not discard its own session once the lock is lost, even when checkout is now blocked', async () => {
    const stripe = fakeStripe()
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }
    const aRecheck = holdCall(stripe, 'listSubscriptionStatuses', 2)

    const requestA = startCheckout(deps, existing) // creates cs_1; its subscription re-check stalls
    await aRecheck.held
    expireLease()
    expect(await lock.acquire('user-1', 'later-request', 30)).toBe(true)
    stripe.pay('cs_1')
    aRecheck.send()

    await expect(requestA).resolves.toEqual(lostLock)
    expect(stripe.expireCalls).toEqual([])
    expect(lock.holder()).toBe('later-request')
  })

  // Known limit: a session creation sent while the lock was held cannot be
  // recalled. It can leave an extra open session, but its URL is never handed
  // out and the next checkout expires it.
  it('never hands out a session that a stalled request created after the takeover', async () => {
    const stripe = fakeStripe()
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }
    const aCreate = holdCall(stripe, 'createSession')

    const requestA = startCheckout(deps, existing) // its create call stalls before reaching Stripe
    await aCreate.held
    expireLease()
    const resultB = await startCheckout(deps, existing)
    expect(resultB).toEqual({ kind: 'redirect', url: cs('cs_1') })

    aCreate.send() // A's session, cs_2, is created late
    await expect(requestA).resolves.toEqual(lostLock)
    expect(stripe.expireCalls).toEqual([]) // A did not touch B's session
    expect(urlsOf(stripe.open())).toEqual([cs('cs_1'), cs('cs_2')]) // cs_2 is open but no one has its URL

    await expect(startCheckout(deps, existing)).resolves.toEqual({ kind: 'redirect', url: cs('cs_3') })
    expect(urlsOf(stripe.open())).toEqual([cs('cs_3')])
  })

  it('keeps its own session when Stripe timestamps tie, whatever the session ids are', async () => {
    // Same second, and the older session has the greater id, so "newest, ties by id" would pick the older one.
    const stripe = fakeStripe({ sameSecond: true, sessionIds: ['cs_b', 'cs_a'] })
    const deps = { gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock }
    await expect(startCheckout(deps, existing)).resolves.toEqual({ kind: 'redirect', url: cs('cs_b') })
    await expect(startCheckout(deps, existing)).resolves.toEqual({ kind: 'redirect', url: cs('cs_a') })
    expect(stripe.expireCalls).toEqual(['cs_b'])
    expect(urlsOf(stripe.open())).toEqual([cs('cs_a')])
  })
})

describe('startCheckout session verification', () => {
  const existing = { ...input, customerId: 'cus_existing' }
  const deps = (stripe: ReturnType<typeof fakeStripe>) => ({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock })

  it('verifies the created session by id and does not depend on the list showing it', async () => {
    const stripe = fakeStripe()
    const retrieved: string[] = []
    const retrieve = stripe.gateway.retrieveSession
    stripe.gateway.retrieveSession = async (id) => { retrieved.push(id); return retrieve(id) }
    // Stripe has created the session but its list does not show it yet.
    const list = stripe.gateway.listOpenSessions
    stripe.gateway.listOpenSessions = async (customer) => (await list(customer)).filter((session) => session.id !== 'cs_1')

    await expect(startCheckout(deps(stripe), existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' })
    expect(retrieved).toEqual(['cs_1'])
    expect(stripe.expireCalls).toEqual([])
  })

  const session = (overrides: Partial<SessionState> = {}): SessionState => ({ id: 'cs_1', customerId: 'cus_existing', status: 'open', url: 'https://checkout.stripe.test/cs_1', expiresAt: null, ...overrides })

  it.each([
    ['missing', null],
    ['wrong-session', session({ id: 'cs_other' })],
    ['wrong-customer', session({ customerId: 'cus_someone_else' })],
    ['wrong-customer', session({ customerId: null })],
    ['not-open', session({ status: 'expired' })],
    ['not-open', session({ status: 'complete' })],
    ['not-open', session({ status: null })],
    ['expired', session({ expiresAt: 1 })],
    ['no-url', session({ url: null })],
    ['no-url', session({ url: '' })],
  ] as const)('returns no URL when the created session is %s', async (problem, state) => {
    const stripe = fakeStripe()
    stripe.gateway.retrieveSession = async () => state
    const result = await startCheckout(deps(stripe), existing)

    expect(result).toEqual({ kind: 'contended', reason: 'session-stale', customerId: 'cus_existing', problem })
    expect(lock.holder()).toBeNull()
    // A session that could still be opened is not left payable; one that is not ours is not touched.
    expect(stripe.expireCalls).toEqual(problem === 'no-url' || problem === 'expired' ? ['cs_1'] : [])
  })

  it('accepts an open session of this customer with a URL and a future expiry', () => {
    const expected = { id: 'cs_1', customerId: 'cus_existing' }
    expect(sessionProblem(session({ expiresAt: 2_000 }), expected, 1_999_999)).toBeNull()
    expect(sessionProblem(session({ expiresAt: 2_000 }), expected, 2_000_000)).toBe('expired')
    expect(sessionProblem(session(), expected, Date.now())).toBeNull()
  })

  it('returns no URL when the lock is lost between verifying the session and redirecting', async () => {
    const stripe = fakeStripe()
    const retrieve = stripe.gateway.retrieveSession
    stripe.gateway.retrieveSession = async (id) => {
      const state = await retrieve(id) // the session verifies as open
      lock.held.set('user-1', { token: 'other-request', expiresAt: 60_000 }) // and then the lock changes hands
      return state
    }
    const result = await startCheckout(deps(stripe), existing)

    expect(result).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(stripe.expireCalls).toEqual([]) // nothing is changed once the lock is gone
    expect(lock.holder()).toBe('other-request')
  })

  it('returns no URL when the last renewal is refused because the lease ran out during verification', async () => {
    const stripe = fakeStripe()
    const retrieve = stripe.gateway.retrieveSession
    stripe.gateway.retrieveSession = async (id) => {
      lock.clock.now += CHECKOUT_TIMING.leaseSeconds * 1000
      return retrieve(id)
    }
    const result = await startCheckout({ ...deps(stripe), timing: { now: () => lock.clock.now } }, existing)
    expect(result).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
  })

  it('returns no URL when the database fails at the final ownership check', async () => {
    const stripe = fakeStripe()
    const run = recorded(stripe.gateway, lock)
    // With nothing to sweep, the fifth renewal is the final check: create, list, re-check, retrieve, final.
    let renewals = 0
    const failingLock: CheckoutLock = { ...run.lock, renew: async (...args) => { if (++renewals === 5) { run.order.push('renew (fails)'); throw new Error('database unreachable') } return run.lock.renew(...args) } }

    await expect(startCheckout({ gateway: run.gateway, claims: memoryClaims('cus_existing'), lock: failingLock }, existing)).rejects.toThrow('database unreachable')
    expect(run.order.slice(run.order.indexOf('retrieveSession'))).toEqual(['retrieveSession', 'renew (fails)', 'renew', 'expireSession', 'release'])
    expect(stripe.open()).toEqual([]) // the session it could not hand out is not left payable
    expect(lock.holder()).toBeNull()
  })

  it('returns no URL when the final ownership check comes back only after the lease has run out', async () => {
    const stripe = fakeStripe()
    let renewals = 0
    const slowLock: CheckoutLock = {
      ...lock,
      renew: async (...args) => {
        const held = await lock.renew(...args)
        if (++renewals === 5) lock.clock.now += CHECKOUT_TIMING.leaseSeconds * 1000 // the confirmation itself took a whole lease
        return held
      },
    }
    const result = await startCheckout({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock: slowLock, timing: { now: () => lock.clock.now } }, existing)
    expect(result).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
  })
})

describe('startCheckout and Stripe timeouts', () => {
  const existing = { ...input, customerId: 'cus_existing' }
  const timed = (stripe: ReturnType<typeof fakeStripe>) => ({ gateway: stripe.gateway, claims: memoryClaims('cus_existing'), lock, timing: { now: () => lock.clock.now } })
  /** Makes a gateway call take `ms` of lease time. */
  function slow<K extends (typeof STRIPE_CALLS)[number]>(stripe: ReturnType<typeof fakeStripe>, method: K, ms: number) {
    const original = stripe.gateway[method] as (argument: string) => Promise<unknown>
    stripe.gateway[method] = (async (argument: string) => {
      const result = await original(argument)
      lock.clock.now += ms
      return result
    }) as CheckoutGateway[K]
  }

  it('derives the per-call budget from the installed SDK and keeps it well inside the lease', () => {
    const leaseMs = CHECKOUT_TIMING.leaseSeconds * 1000
    expect(CHECKOUT_STRIPE_REQUEST).toEqual({ timeout: 10_000, maxNetworkRetries: 1 })
    expect(CHECKOUT_TIMING.leaseSeconds).toBe(90)
    // Two attempts of 10 seconds and the SDK's 0.5-second wait before the retry.
    expect(STRIPE_CALL_BUDGET_MS).toBe(20_500)
    // The lock is renewed before every call, so the lease has to outlast one call; it does so four times over.
    expect(STRIPE_CALL_BUDGET_MS * 4).toBeLessThan(leaseMs)
    // The lease functions cap a lease at 300 seconds (checkout_lock_lease in the lock migration).
    expect(CHECKOUT_TIMING.leaseSeconds).toBeLessThanOrEqual(300)
  })

  // The budget rests on how one SDK version behaves: a 0.5-second first retry
  // delay, and a Retry-After header that is ignored because it arrives as a
  // string. Both are read from the installed source here, so an upgrade that
  // changes either fails this test and the budget in limits.ts is rechecked.
  it('rests on retry behaviour of the installed Stripe SDK, which must be rechecked on upgrade', () => {
    const require = createRequire(import.meta.url)
    const root = require.resolve('stripe').replace(/cjs[\\/][^\\/]+$/, '') // the package does not export its package.json
    expect(JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version).toBe(STRIPE_SDK_VERSION_FOR_BUDGET)

    const core = readFileSync(`${root}cjs/stripe.core.js`, 'utf8')
    expect(core).toContain('const INITIAL_NETWORK_RETRY_DELAY_SEC = 0.5;')
    const sender = readFileSync(`${root}cjs/RequestSender.js`, 'utf8')
    expect(sender).toContain('if (Number.isInteger(retryAfter) && retryAfter <= MAX_RETRY_AFTER_WAIT) {')
    expect(sender).toContain("res.getHeaders()['retry-after']") // passed on as received: a string from Node's HTTP client
    expect(Number.isInteger('30')).toBe(false)
  })

  it('completes a run that takes longer than one lease when every call takes the longest a call can', async () => {
    const stripe = fakeStripe()
    await startCheckout(timed(stripe), existing) // cs_1, so the next request has something to expire
    for (const call of STRIPE_CALLS) slow(stripe, call, STRIPE_CALL_BUDGET_MS)
    const startedAt = lock.clock.now

    await expect(startCheckout(timed(stripe), existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(stripe.open().map((session) => session.id)).toEqual(['cs_2'])
    // Six calls: longer than a lease in total, which only works because the lock is renewed before each one.
    expect(lock.clock.now - startedAt).toBe(6 * STRIPE_CALL_BUDGET_MS)
    expect(lock.clock.now - startedAt).toBeGreaterThan(CHECKOUT_TIMING.leaseSeconds * 1000)
  })

  it('stops without expiring anything when one slow call uses up the lease before the sweep', async () => {
    const stripe = fakeStripe()
    await startCheckout(timed(stripe), existing) // cs_1
    slow(stripe, 'listOpenSessions', CHECKOUT_TIMING.leaseSeconds * 1000) // longer than the SDK limits allow; the lease is the backstop

    await expect(startCheckout(timed(stripe), existing)).resolves.toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
    expect(stripe.expireCalls).toEqual([])
  })

  it.each(STRIPE_CALLS.map((call) => [call] as const))('returns no URL when %s alone outlasts the lease', async (call) => {
    const stripe = fakeStripe()
    await startCheckout(timed(stripe), existing) // cs_1
    slow(stripe, call, CHECKOUT_TIMING.leaseSeconds * 1000)
    const result = await startCheckout(timed(stripe), existing)
    expect(result).toEqual({ kind: 'contended', reason: 'lock-lost', customerId: 'cus_existing' })
  })

  // A timeout only stops the local wait. Stripe may already have created the session.
  it('hands out nothing when session creation succeeds at Stripe but times out locally, and the next checkout expires that session', async () => {
    const stripe = fakeStripe()
    const create = stripe.gateway.createSession
    let lostResponse = true
    stripe.gateway.createSession = async (customer) => {
      const created = await create(customer)
      if (lostResponse) throw new Error('Request timed out')
      return created
    }

    await expect(startCheckout(timed(stripe), existing)).rejects.toThrow('Request timed out')
    expect(lock.holder()).toBeNull()
    expect(stripe.open().map((session) => session.id)).toEqual(['cs_1']) // open, but its URL was never returned

    lostResponse = false
    await expect(startCheckout(timed(stripe), existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(stripe.open().map((session) => session.id)).toEqual(['cs_2'])
  })

  it('goes by the session\'s real state when an expiry succeeds at Stripe but times out locally', async () => {
    const stripe = fakeStripe()
    await startCheckout(timed(stripe), existing) // cs_1
    const expire = stripe.gateway.expireSession
    stripe.gateway.expireSession = async (id) => {
      await expire(id)
      throw new Error('Request timed out')
    }

    await expect(startCheckout(timed(stripe), existing)).resolves.toEqual({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_2' })
    expect(stripe.open().map((session) => session.id)).toEqual(['cs_2'])
  })

  it('does not leave its session payable when verification times out', async () => {
    const stripe = fakeStripe()
    stripe.gateway.retrieveSession = async () => { throw new Error('Request timed out') }

    await expect(startCheckout(timed(stripe), existing)).rejects.toThrow('Request timed out')
    expect(stripe.expireCalls).toEqual(['cs_1'])
    expect(stripe.open()).toEqual([])
    expect(lock.holder()).toBeNull()
  })

  it('does not touch its session after an error if the lock has been lost', async () => {
    const stripe = fakeStripe()
    stripe.gateway.retrieveSession = async () => {
      lock.held.set('user-1', { token: 'other-request', expiresAt: lock.clock.now + 60_000 })
      throw new Error('Request timed out')
    }

    await expect(startCheckout(timed(stripe), existing)).rejects.toThrow('Request timed out')
    expect(stripe.expireCalls).toEqual([])
    expect(lock.holder()).toBe('other-request')
  })
})

describe('checkout helpers', () => {
  it('picks the newest session, breaking ties by id', () => {
    expect(chooseKeeperSession([{ id: 'a', created: 1, url: null }, { id: 'c', created: 2, url: null }, { id: 'b', created: 2, url: null }])?.id).toBe('c')
    expect(chooseKeeperSession([])).toBeNull()
  })

  it('treats only billing subscriptions as blocking', () => {
    expect(blockingSubscription(['canceled', 'incomplete_expired', 'unpaid'])).toBeNull()
    expect(blockingSubscription(['canceled', 'incomplete'])).toBe('payment-pending')
    expect(blockingSubscription(['trialing'])).toBe('already-subscribed')
    expect(blockingSubscription(['active', 'past_due'])).toBe('payment-required')
  })
})
