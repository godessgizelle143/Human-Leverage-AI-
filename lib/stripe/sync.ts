import type Stripe from 'stripe'
import { getSubscriptionPeriod } from './period'

/**
 * Stripe → subscriptions row synchronisation.
 *
 * Every webhook event is only a trigger: the handler re-reads the subscription
 * from Stripe and plans one write from (stored row, current Stripe state).
 * That makes duplicate deliveries no-ops and out-of-order deliveries harmless,
 * and the write is conditional on the row still holding the subscription and
 * period that were read, so concurrent deliveries cannot overwrite each other.
 *
 * Usage counters are reset only when a new entitlement has been paid for:
 * a newer billing period of the current subscription, or a new subscription
 * that is already active. Never because an event arrived.
 */

export const PAID_PLANS = ['creator', 'professional', 'business'] as const
export type PaidPlan = (typeof PAID_PLANS)[number]

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && (PAID_PLANS as readonly string[]).includes(value)
}

/** Stripe statuses where the subscription is still billing the customer. */
const LIVE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])
/** Stripe statuses a subscription never leaves. */
const ENDED_STATUSES = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired'])
/** Statuses in which a subscription may become (or replace) the account's subscription. */
const ATTACHABLE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing'])

export const isLiveSubscriptionStatus = (status: Stripe.Subscription.Status) => LIVE_STATUSES.has(status)

export function toRowStatus(status: Stripe.Subscription.Status): 'active' | 'cancelled' | 'past_due' | 'trialing' {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return status
  return 'cancelled'
}

/** The subscriptions columns this sync reads. */
export type BillingRow = {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  current_period_start: string | null
}

/** The fields of a Stripe subscription this sync needs, already normalised. */
export type RemoteSubscription = {
  id: string
  customerId: string
  status: Stripe.Subscription.Status
  periodStart: string
  periodEnd: string
  userId: string | null
  plan: PaidPlan | null
}

export type RowValues = {
  stripe_customer_id?: string
  stripe_subscription_id: string
  plan?: PaidPlan
  status: ReturnType<typeof toRowStatus>
  current_period_start: string
  current_period_end: string
  interviews_used?: 0
  builds_used?: 0
}

export type SyncPlan =
  | { action: 'ignore'; reason: 'no_account' | 'not_yet_active' | 'stale_period' | 'superseded' | 'missing_plan' }
  /** A second subscription is billing an account whose recorded one is still live. Nothing is written or changed in Stripe. */
  | { action: 'ignore'; reason: 'duplicate_live_subscription'; userId: string; keptSubscriptionId: string; duplicateSubscriptionId: string }
  | { action: 'insert'; userId: string; values: RowValues & { plan: PaidPlan } }
  | { action: 'update'; expected: { userId: string; subscriptionId: string | null; periodStart: string | null }; values: RowValues; resetsUsage: boolean }

const RESET = { interviews_used: 0, builds_used: 0 } as const

function time(iso: string | null) {
  return iso ? new Date(iso).getTime() : Number.NEGATIVE_INFINITY
}

/**
 * Decides the single write (if any) that brings the row in line with Stripe.
 *
 * - No row: create one, only for an attachable subscription with a known plan.
 * - Row without a Stripe subscription (cardless trial): attach. A trialing
 *   subscription continues the same trial, so usage carries over; an active
 *   one was paid for, so usage starts at zero.
 * - Same subscription: an older period is stale and ignored; a newer period
 *   resets usage once; the same period only updates status and end.
 * - Different subscription: ignored if it has ended or is not active yet, or
 *   while the current one is still live (a duplicate that needs a human).
 *   Otherwise it replaces the current one.
 */
export function planSubscriptionSync(input: {
  row: BillingRow | null
  sub: RemoteSubscription
  userId: string | null
  plan: PaidPlan | null
  /** Stripe status of row.stripe_subscription_id; required when it differs from sub.id. */
  currentStatus?: Stripe.Subscription.Status | null
}): SyncPlan {
  const { row, sub } = input
  const plan = input.plan ?? sub.plan
  const base: RowValues = {
    stripe_subscription_id: sub.id,
    status: toRowStatus(sub.status),
    current_period_start: sub.periodStart,
    current_period_end: sub.periodEnd,
  }

  if (!row) {
    const userId = input.userId ?? sub.userId
    if (!userId) return { action: 'ignore', reason: 'no_account' }
    if (!ATTACHABLE_STATUSES.has(sub.status)) return { action: 'ignore', reason: 'not_yet_active' }
    if (!plan) return { action: 'ignore', reason: 'missing_plan' }
    return { action: 'insert', userId, values: { ...base, stripe_customer_id: sub.customerId, plan } }
  }

  const expected = { userId: row.user_id, subscriptionId: row.stripe_subscription_id, periodStart: row.current_period_start }

  if (row.stripe_subscription_id === sub.id) {
    const start = time(sub.periodStart)
    const stored = time(row.current_period_start)
    if (start < stored) return { action: 'ignore', reason: 'stale_period' }
    const newerPeriod = start > stored && LIVE_STATUSES.has(sub.status)
    return { action: 'update', expected, values: newerPeriod ? { ...base, ...RESET } : base, resetsUsage: newerPeriod }
  }

  if (!ATTACHABLE_STATUSES.has(sub.status)) {
    return { action: 'ignore', reason: ENDED_STATUSES.has(sub.status) ? 'superseded' : 'not_yet_active' }
  }

  if (row.stripe_subscription_id) {
    if (input.currentStatus === undefined) throw new Error('currentStatus is required to replace a subscription')
    if (input.currentStatus && LIVE_STATUSES.has(input.currentStatus)) {
      return { action: 'ignore', reason: 'duplicate_live_subscription', userId: row.user_id, keptSubscriptionId: row.stripe_subscription_id, duplicateSubscriptionId: sub.id }
    }
  }

  const paid = sub.status === 'active'
  return {
    action: 'update',
    expected,
    values: { ...base, stripe_customer_id: sub.customerId, ...(plan ? { plan } : {}), ...(paid ? RESET : {}) },
    resetsUsage: paid,
  }
}

export function toRemoteSubscription(subscription: Stripe.Subscription): RemoteSubscription {
  const period = getSubscriptionPeriod(subscription)
  if (!period) throw new Error(`Subscription ${subscription.id} has no billing period data`)
  return {
    id: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    periodStart: period.start,
    periodEnd: period.end,
    userId: subscription.metadata?.user_id || null,
    plan: isPaidPlan(subscription.metadata?.plan) ? subscription.metadata.plan : null,
  }
}

/** Thrown when the stored row could not be read or changed underneath us; Stripe should retry. */
export class RetryableSyncError extends Error {}

/**
 * A conditional update matched no rows although the row still holds the
 * expected state (or has disappeared). That is not a concurrent change: it
 * points at the write itself (filter encoding, permissions/RLS, a wrong key).
 * Still retryable, but reported distinctly so it is not mistaken for a race.
 */
export class UnexpectedWriteError extends RetryableSyncError {}

export type WriteExpectation = { userId: string; subscriptionId: string | null; periodStart: string | null }

const sameInstant = (a: string | null, b: string | null) => (a === null || b === null ? a === b : new Date(a).getTime() === new Date(b).getTime())

/** Why a conditional update matched zero rows, judged from a fresh read of the row. */
export function classifyZeroRowUpdate(expected: WriteExpectation, current: BillingRow | null): 'conflict' | 'missing' | 'unchanged' {
  if (!current) return 'missing'
  return current.stripe_subscription_id === expected.subscriptionId && sameInstant(current.current_period_start, expected.periodStart) ? 'unchanged' : 'conflict'
}

export type BillingStore = {
  /** Both throw RetryableSyncError when the read fails. */
  findByUserId(userId: string): Promise<BillingRow | null>
  findByCustomerId(customerId: string): Promise<BillingRow | null>
  insert(userId: string, values: RowValues & { plan: PaidPlan }): Promise<'inserted' | 'conflict'>
  /**
   * Applies only if the row still has the expected subscription and period.
   * Returns 'conflict' only when a re-read shows the row changed; throws
   * UnexpectedWriteError when nothing matched but the row did not change.
   */
  update(expected: WriteExpectation, values: RowValues): Promise<'updated' | 'conflict'>
}

export type SyncDeps = {
  store: BillingStore
  /** Current Stripe state, or null when the subscription does not exist. */
  retrieve(subscriptionId: string): Promise<RemoteSubscription | null>
}

export async function syncSubscription(deps: SyncDeps, input: { subscriptionId: string; userId?: string | null; plan?: unknown }): Promise<SyncPlan> {
  const sub = await deps.retrieve(input.subscriptionId)
  if (!sub) return { action: 'ignore', reason: 'superseded' }

  const userId = input.userId || sub.userId
  const row = (userId ? await deps.store.findByUserId(userId) : null) ?? (await deps.store.findByCustomerId(sub.customerId))

  let currentStatus: Stripe.Subscription.Status | null | undefined
  if (row?.stripe_subscription_id && row.stripe_subscription_id !== sub.id && ATTACHABLE_STATUSES.has(sub.status)) {
    currentStatus = (await deps.retrieve(row.stripe_subscription_id))?.status ?? null
  }

  const plan = planSubscriptionSync({ row, sub, userId, plan: isPaidPlan(input.plan) ? input.plan : null, currentStatus })

  if (plan.action === 'insert' && (await deps.store.insert(plan.userId, plan.values)) === 'conflict') {
    throw new RetryableSyncError('Subscription row was created concurrently')
  }
  if (plan.action === 'update' && (await deps.store.update(plan.expected, plan.values)) === 'conflict') {
    throw new RetryableSyncError('Subscription row changed concurrently')
  }
  return plan
}
