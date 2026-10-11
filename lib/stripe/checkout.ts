import { randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import { STRIPE_CALL_BUDGET_MS, STRIPE_REQUEST_LIMITS } from './limits'
import { isLiveSubscriptionStatus } from './sync'

/**
 * Checkout that avoids duplicate subscriptions as far as Stripe allows.
 *
 * 1. One Stripe customer per account: a new customer is claimed on the
 *    subscriptions row with a compare-and-swap, so concurrent requests agree
 *    on a single customer (the loser deletes its unused one).
 * 2. Stripe, not the database row, decides whether the customer already has
 *    a billing subscription, so a webhook that has not arrived yet cannot hide
 *    one.
 * 3. After creating its session, a request keeps that session and expires
 *    every other open one. If any of them cannot be expired and is still open,
 *    no checkout URL is returned (fail closed).
 * 4. Steps 2-3 run under a per-account lock (CheckoutLock), so one request's
 *    list of open sessions cannot go stale while another request creates and
 *    expires sessions. The lock is leased: a crashed holder is recovered when
 *    its lease runs out.
 * 5. The database, not this process's clock, decides whether the lock is
 *    still held: the request renews the lock immediately before every Stripe
 *    call it makes under the lock, reads included, and stops, changing and
 *    returning nothing more, once a renewal is refused.
 * 6. Before a URL is returned, the request retrieves its own session by id
 *    (not from a list, which may not show a new session yet) and checks that
 *    it is open, unexpired, has a URL, and belongs to the customer. The last
 *    step is one more lock renewal; only if the database confirms the lock is
 *    the URL returned.
 * 7. Every Stripe request is bounded (CHECKOUT_STRIPE_REQUEST), so a call
 *    that starts right after a renewal finishes locally well inside the lease.
 *
 * Renewing before every call does not remove every network race, which is why
 * the final renewal in step 6 stays: it is the check the returned URL rests on.
 *
 * What the lock cannot do: a timeout only stops this process waiting. A Stripe
 * call that was sent while the lock was held cannot be recalled, and may still
 * take effect after the local request gave up or the lease ran out. Two rules
 * keep such a late call from invalidating a URL another request returned: a
 * request only ever returns its own session, and it only expires sessions it
 * listed before a successful renewal, which were therefore created before any
 * later holder's session. A session creation that takes effect late, or whose
 * response was lost, can still leave an extra open session that no one was
 * given the URL for, until the next checkout expires it.
 *
 * This narrows, but does not close, the window for a second payment: Stripe
 * does not enforce one subscription per customer, and a payment can complete
 * on a session this request never saw. The webhook detects and reports such
 * duplicates (sync.ts); it never cancels or refunds automatically.
 */

export type OpenSession = { id: string; created: number; url: string | null }

/** A Checkout Session as Stripe reports it when retrieved by id. */
export type SessionState = {
  id: string
  customerId: string | null
  status: 'open' | 'complete' | 'expired' | null
  url: string | null
  /** Unix seconds. */
  expiresAt: number | null
}

export type CheckoutGateway = {
  createCustomer(input: { userId: string; email: string | null }): Promise<string>
  deleteCustomer(customerId: string): Promise<void>
  listSubscriptionStatuses(customerId: string): Promise<Stripe.Subscription.Status[]>
  listOpenSessions(customerId: string): Promise<OpenSession[]>
  createSession(customerId: string): Promise<OpenSession>
  /** The session's current state, or null when Stripe has no such session. */
  retrieveSession(sessionId: string): Promise<SessionState | null>
  expireSession(sessionId: string): Promise<void>
}

export type CustomerClaim = {
  /** Stores customerId if the account has none; returns the stored id (null when the account has no row). */
  claim(userId: string, customerId: string): Promise<string | null>
}

export type CheckoutLock = {
  /** Atomically takes the account's lock unless an unexpired holder has it. */
  acquire(userId: string, token: string, leaseSeconds: number): Promise<boolean>
  /** Extends the lease only while `token` still holds it; false means the lock was lost. */
  renew(userId: string, token: string, leaseSeconds: number): Promise<boolean>
  /** Releases the lock only if `token` holds it. */
  release(userId: string, token: string): Promise<void>
}

export type CheckoutTiming = {
  /** How long a holder may keep the lock without renewing; also how long a crashed holder blocks the account. */
  leaseSeconds: number
  /** A request waits for a busy lock for at most acquireAttempts - 1 delays. */
  acquireAttempts: number
  retryDelayMs: number
  wait(ms: number): Promise<void>
  now(): number
}

/** Every Stripe call checkout makes is bounded; see limits.ts for how the per-call budget is derived. */
export const CHECKOUT_STRIPE_REQUEST = STRIPE_REQUEST_LIMITS
export { STRIPE_CALL_BUDGET_MS }

/**
 * The lock is renewed immediately before every Stripe call made under it, so
 * the lease only has to outlast one call (STRIPE_CALL_BUDGET_MS, about 20
 * seconds). 90 seconds leaves over a minute beyond that for a write Stripe is
 * slow to apply after the local request has given up. It is also the longest
 * a request that is cut off (the route's maxDuration is 60 seconds) or crashes
 * can keep an account's checkout locked.
 */
export const CHECKOUT_TIMING: CheckoutTiming = {
  leaseSeconds: 90,
  acquireAttempts: 21,
  retryDelayMs: 250,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
}

export type ExpiryFailure = { sessionId: string; message: string }

export type BlockReason = 'already-subscribed' | 'payment-required' | 'payment-pending'

/**
 * lock-busy: another checkout for the account held the lock for the whole wait.
 * lock-lost: this request's lease ran out or was taken over before it finished.
 * session-stale: the chosen session stopped being open before its URL was returned.
 */
export type ContentionReason = 'lock-busy' | 'lock-lost' | 'session-stale'

/** Why a created session may not be handed out. */
export type SessionProblem = 'missing' | 'wrong-session' | 'wrong-customer' | 'not-open' | 'expired' | 'no-url'

/** Checks a retrieved session against the one this request created; null means its URL may be returned. */
export function sessionProblem(session: SessionState | null, expected: { id: string; customerId: string }, nowMs: number): SessionProblem | null {
  if (!session) return 'missing'
  if (session.id !== expected.id) return 'wrong-session'
  if (session.customerId !== expected.customerId) return 'wrong-customer'
  if (session.status !== 'open') return 'not-open'
  if (session.expiresAt !== null && session.expiresAt * 1000 <= nowMs) return 'expired'
  if (!session.url) return 'no-url'
  return null
}

export type CheckoutResult =
  | { kind: 'redirect'; url: string }
  /** No URL is returned and nothing further was changed; retrying is safe. */
  | { kind: 'contended'; reason: ContentionReason; customerId: string; problem?: SessionProblem }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'unavailable' }
  /** An older session could not be expired and is still payable; retrying is safe. */
  | { kind: 'cleanup_failed'; customerId: string; stillOpen: string[]; failures: ExpiryFailure[] }

/**
 * The newest open session (ties broken by id). startCheckout no longer uses
 * this: under the checkout lock a request keeps its own session instead.
 */
export function chooseKeeperSession(sessions: OpenSession[]): OpenSession | null {
  return sessions.reduce<OpenSession | null>(
    (best, session) => (!best || session.created > best.created || (session.created === best.created && session.id > best.id) ? session : best),
    null,
  )
}

export function blockingSubscription(statuses: Stripe.Subscription.Status[]): BlockReason | null {
  if (statuses.includes('past_due')) return 'payment-required'
  if (statuses.some(isLiveSubscriptionStatus)) return 'already-subscribed'
  // A completed checkout whose first payment is still processing (e.g. a bank debit).
  if (statuses.includes('incomplete')) return 'payment-pending'
  return null
}

async function resolveCustomer(gateway: CheckoutGateway, claims: CustomerClaim, input: { userId: string; email: string | null; customerId: string | null }) {
  if (input.customerId) return input.customerId
  const created = await gateway.createCustomer({ userId: input.userId, email: input.email })
  const stored = await claims.claim(input.userId, created)
  if (stored !== created) {
    await gateway.deleteCustomer(created).catch((error) => console.error('Unused Stripe customer could not be deleted:', created, error instanceof Error ? error.message : ''))
  }
  return stored
}

/** Tracks how long this request may still rely on its lock, measured from before each acquire or renew call. */
function leaseOf(lock: CheckoutLock, timing: CheckoutTiming, userId: string, token: string) {
  let heldUntil = 0
  const attempt = async (call: () => Promise<boolean>) => {
    const startedAt = timing.now()
    const held = await call()
    heldUntil = held ? startedAt + timing.leaseSeconds * 1000 : 0
    return held
  }
  return {
    async acquire() {
      for (let attemptNumber = 1; attemptNumber <= timing.acquireAttempts; attemptNumber++) {
        if (await attempt(() => lock.acquire(userId, token, timing.leaseSeconds))) return true
        if (attemptNumber < timing.acquireAttempts) await timing.wait(timing.retryDelayMs)
      }
      return false
    },
    renew: () => attempt(() => lock.renew(userId, token, timing.leaseSeconds)),
    /** False once the lease may have run out, by this process's clock. */
    live: () => timing.now() < heldUntil,
    now: () => timing.now(),
    release: () => lock.release(userId, token),
  }
}

export async function startCheckout(
  deps: { gateway: CheckoutGateway; claims: CustomerClaim; lock: CheckoutLock; timing?: Partial<CheckoutTiming> },
  input: { userId: string; email: string | null; customerId: string | null },
): Promise<CheckoutResult> {
  const { gateway } = deps
  const customerId = await resolveCustomer(gateway, deps.claims, input)
  if (!customerId) return { kind: 'unavailable' }

  const lease = leaseOf(deps.lock, { ...CHECKOUT_TIMING, ...deps.timing }, input.userId, randomUUID())
  if (!(await lease.acquire())) return { kind: 'contended', reason: 'lock-busy', customerId }
  try {
    return await checkoutWhileLocked(gateway, lease, customerId)
  } finally {
    // A failed release is recovered by the lease running out; it must not replace the result.
    await lease.release().catch((error) => console.error('Checkout lock could not be released:', input.userId, error instanceof Error ? error.message : ''))
  }
}

async function checkoutWhileLocked(gateway: CheckoutGateway, lease: ReturnType<typeof leaseOf>, customerId: string): Promise<CheckoutResult> {
  // Once a renewal is refused another request may hold the lock, so this one
  // stops without creating, expiring, or returning anything further.
  const lost: CheckoutResult = { kind: 'contended', reason: 'lock-lost', customerId }

  // The lock was acquired immediately before this call.
  const blocked = blockingSubscription(await gateway.listSubscriptionStatuses(customerId))
  if (blocked) return { kind: 'blocked', reason: blocked }

  if (!(await lease.renew())) return lost
  const own = await gateway.createSession(customerId)
  const discard = () => gateway.expireSession(own.id).catch(() => undefined) // our URL is never handed out
  try {
    return await settleOwnSession(gateway, lease, customerId, own, discard, lost)
  } catch (error) {
    // The session exists but its URL will not be returned. While the lock is
    // still ours, do not leave it payable; the original error is what matters.
    if (await lease.renew().catch(() => false)) await discard()
    throw error
  }
}

/** Every Stripe call in here is preceded by a renewal whose result is checked. */
async function settleOwnSession(
  gateway: CheckoutGateway,
  lease: ReturnType<typeof leaseOf>,
  customerId: string,
  own: OpenSession,
  discard: () => Promise<void>,
  lost: CheckoutResult,
): Promise<CheckoutResult> {
  // Under the lock this request's session is the one to keep. Keeping it even
  // when Stripe's one-second timestamps tie, or when a newer session appears,
  // means the only session a request can return is one no earlier holder has
  // listed, so an earlier holder's late expiry cannot reach it.
  if (!(await lease.renew())) return lost
  const others = (await gateway.listOpenSessions(customerId)).filter((session) => session.id !== own.id)

  // This renewal comes after the list: if it succeeds, no other request has
  // held the lock since this one acquired it, so `others` holds no session a
  // later holder will return.
  if (others.length && !(await lease.renew())) return lost
  const failures: ExpiryFailure[] = []
  await Promise.all(
    others
      .map((session) =>
        gateway.expireSession(session.id).catch((error: unknown) => {
          failures.push({ sessionId: session.id, message: error instanceof Error ? error.message : 'Unknown error' })
        }),
      ),
  )

  // Re-check after the sweep: an earlier session may have been paid after the
  // first check (it is then no longer open, so nothing failed to expire, but
  // its subscription now exists). Sessions expired above can no longer be
  // paid, so this check covers every session this request saw. Errors propagate.
  if (!(await lease.renew())) return lost
  const nowBlocked = blockingSubscription(await gateway.listSubscriptionStatuses(customerId))
  if (nowBlocked) {
    if (!(await lease.renew())) return lost
    await discard()
    return { kind: 'blocked', reason: nowBlocked }
  }

  if (failures.length) {
    // A failed expiry may still have taken effect at Stripe, so the session's
    // actual state decides, not the error.
    if (!(await lease.renew())) return lost
    const stillOpen = new Set((await gateway.listOpenSessions(customerId)).map((session) => session.id))
    const unexpired = failures.filter((failure) => stillOpen.has(failure.sessionId)).map((failure) => failure.sessionId)
    if (unexpired.length) {
      if (!(await lease.renew())) return lost
      await discard()
      return { kind: 'cleanup_failed', customerId, stillOpen: unexpired, failures }
    }
  }

  if (!own.url) return { kind: 'unavailable' }

  // Verify the session itself, by id: a list may not show a session Stripe has
  // just created, and would not show who it belongs to.
  if (!(await lease.renew())) return lost
  const problem = sessionProblem(await gateway.retrieveSession(own.id), { id: own.id, customerId }, lease.now())

  // Last step, and the one the returned URL rests on: the database confirms
  // this request still holds the lock. If it does, no other request has held
  // it since it was acquired, so nothing under the lock has changed the session
  // that was just verified. The local clock check covers a confirmation that
  // itself took longer than the lease to come back.
  if (!(await lease.renew()) || !lease.live()) return lost
  if (problem) {
    if (problem === 'no-url' || problem === 'expired') await discard()
    return { kind: 'contended', reason: 'session-stale', customerId, problem }
  }

  return { kind: 'redirect', url: own.url }
}
