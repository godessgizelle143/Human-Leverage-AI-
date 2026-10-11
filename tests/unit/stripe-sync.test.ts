import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { planSubscriptionSync, RetryableSyncError, syncSubscription, type BillingRow, type BillingStore, type RemoteSubscription, type RowValues } from '@/lib/stripe/sync'

const P1 = { periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-11-01T00:00:00.000Z' }
const P2 = { periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-12-01T00:00:00.000Z' }

type StoredRow = BillingRow & { plan: string; current_period_end: string | null; interviews_used: number; builds_used: number }

/** In-memory subscriptions table with the same conditional-write semantics as supabaseBillingStore. */
function memoryStore(initial: StoredRow[] = [], options: { failReads?: boolean } = {}) {
  const rows = new Map(initial.map((row) => [row.user_id, { ...row }]))
  const writes: string[] = []
  const store: BillingStore = {
    async findByUserId(userId) {
      if (options.failReads) throw new RetryableSyncError('read failed')
      return rows.get(userId) ?? null
    },
    async findByCustomerId(customerId) {
      if (options.failReads) throw new RetryableSyncError('read failed')
      return Array.from(rows.values()).find((row) => row.stripe_customer_id === customerId) ?? null
    },
    async insert(userId, values) {
      if (rows.has(userId)) return 'conflict'
      rows.set(userId, { user_id: userId, stripe_customer_id: null, interviews_used: 0, builds_used: 0, ...values })
      writes.push(`insert ${userId}`)
      return 'inserted'
    },
    async update(expected, values: RowValues) {
      const row = rows.get(expected.userId)
      if (!row || row.stripe_subscription_id !== expected.subscriptionId || row.current_period_start !== expected.periodStart) return 'conflict'
      Object.assign(row, values)
      writes.push(`update ${expected.userId}`)
      return 'updated'
    },
  }
  return { store, rows, writes, row: (userId = 'user-1') => rows.get(userId)! }
}

/** Stripe's current view of each subscription; tests mutate it between deliveries. */
function stripeState(subs: RemoteSubscription[]) {
  const state = new Map(subs.map((sub) => [sub.id, sub]))
  return {
    state,
    set: (id: string, changes: Partial<RemoteSubscription>) => state.set(id, { ...state.get(id)!, ...changes }),
    retrieve: async (id: string) => state.get(id) ?? null,
  }
}

function remote(id: string, status: Stripe.Subscription.Status, period = P1, extra: Partial<RemoteSubscription> = {}): RemoteSubscription {
  return { id, customerId: 'cus_1', status, ...period, userId: 'user-1', plan: 'professional', ...extra }
}

function stored(overrides: Partial<StoredRow> = {}): StoredRow {
  return {
    user_id: 'user-1',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    status: 'active',
    plan: 'professional',
    current_period_start: P1.periodStart,
    current_period_end: P1.periodEnd,
    interviews_used: 4,
    builds_used: 7,
    ...overrides,
  }
}

const cardlessTrial = () => stored({ stripe_customer_id: null, stripe_subscription_id: null, status: 'trialing', current_period_start: '2026-10-07T00:00:00.000Z', interviews_used: 15, builds_used: 15 })

describe('webhook delivery', () => {
  it('leaves usage unchanged when the same event is delivered again', async () => {
    const db = memoryStore([stored()])
    const stripe = stripeState([remote('sub_1', 'active')])
    for (let i = 0; i < 3; i++) await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })
    expect(db.row()).toMatchObject({ interviews_used: 4, builds_used: 7, current_period_start: P1.periodStart })
  })

  it('leaves usage unchanged on a redelivered checkout.session.completed', async () => {
    const db = memoryStore([stored()])
    const stripe = stripeState([remote('sub_1', 'active')])
    const plan = await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1', userId: 'user-1', plan: 'professional' })
    expect(plan).toMatchObject({ action: 'update', resetsUsage: false })
    expect(db.row()).toMatchObject({ builds_used: 7 })
  })

  it('resets usage exactly once for a newer billing period', async () => {
    const db = memoryStore([stored()])
    const stripe = stripeState([remote('sub_1', 'active')])
    const deps = { store: db.store, retrieve: stripe.retrieve }

    stripe.set('sub_1', P2)
    await expect(syncSubscription(deps, { subscriptionId: 'sub_1' })).resolves.toMatchObject({ resetsUsage: true })
    expect(db.row()).toMatchObject({ builds_used: 0, interviews_used: 0, current_period_start: P2.periodStart, current_period_end: P2.periodEnd })

    db.row().builds_used = 3 // the user builds in the new period
    await expect(syncSubscription(deps, { subscriptionId: 'sub_1' })).resolves.toMatchObject({ resetsUsage: false })
    expect(db.row().builds_used).toBe(3)
  })

  it('ignores an older period instead of moving the stored period backwards', async () => {
    const db = memoryStore([stored({ current_period_start: P2.periodStart, current_period_end: P2.periodEnd, builds_used: 2 })])
    const stripe = stripeState([remote('sub_1', 'active', P1)]) // a handler holding an older snapshot
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })).resolves.toEqual({ action: 'ignore', reason: 'stale_period' })
    expect(db.row()).toMatchObject({ current_period_start: P2.periodStart, builds_used: 2 })
    expect(db.writes).toEqual([])
  })

  it('does not reactivate a cancelled subscription when an older "updated" arrives after "deleted"', async () => {
    const db = memoryStore([stored({ status: 'cancelled' })])
    const stripe = stripeState([remote('sub_1', 'canceled')]) // Stripe's current state, whatever the event said
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })
    expect(db.row()).toMatchObject({ status: 'cancelled', builds_used: 7 })
  })

  it('does not reset usage when a payment recovers within the same period', async () => {
    const db = memoryStore([stored({ status: 'past_due' })])
    const stripe = stripeState([remote('sub_1', 'active')])
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })
    expect(db.row()).toMatchObject({ status: 'active', builds_used: 7 })
  })
})

describe('trial credits', () => {
  it('carries cardless-trial usage over when checkout continues the same trial', async () => {
    const db = memoryStore([cardlessTrial()])
    const stripe = stripeState([remote('sub_1', 'trialing', { periodStart: '2026-10-08T00:00:00.000Z', periodEnd: '2026-10-10T00:00:00.000Z' })])
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1', userId: 'user-1', plan: 'professional' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', status: 'trialing', interviews_used: 15, builds_used: 15 })
  })

  it('cannot gain credits by cancelling during the trial and subscribing again on a new trial', async () => {
    const db = memoryStore([cardlessTrial()])
    const stripe = stripeState([remote('sub_1', 'trialing'), remote('sub_2', 'trialing')])
    const deps = { store: db.store, retrieve: stripe.retrieve }
    await syncSubscription(deps, { subscriptionId: 'sub_1', userId: 'user-1' })
    stripe.set('sub_1', { status: 'canceled' })
    await syncSubscription(deps, { subscriptionId: 'sub_1' })
    await syncSubscription(deps, { subscriptionId: 'sub_2', userId: 'user-1' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: 'sub_2', builds_used: 15, interviews_used: 15 })
  })

  it('starts usage at zero when the first subscription is paid immediately', async () => {
    const db = memoryStore([cardlessTrial()])
    const stripe = stripeState([remote('sub_1', 'active')])
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1', userId: 'user-1', plan: 'creator' })
    expect(db.row()).toMatchObject({ status: 'active', plan: 'creator', builds_used: 0 })
  })

  it('does not attach a subscription before it is active or trialing', async () => {
    const db = memoryStore([cardlessTrial()])
    const stripe = stripeState([remote('sub_1', 'incomplete')])
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1', userId: 'user-1' })).resolves.toEqual({ action: 'ignore', reason: 'not_yet_active' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: null, builds_used: 15 })
  })
})

describe('replaced and duplicate subscriptions', () => {
  it('ignores events for a replaced subscription, including its deletion', async () => {
    const db = memoryStore([stored({ stripe_subscription_id: 'sub_new', builds_used: 2 })])
    const stripe = stripeState([remote('sub_new', 'active'), remote('sub_old', 'canceled', P2)])
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_old' })).resolves.toEqual({ action: 'ignore', reason: 'superseded' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active', builds_used: 2, current_period_start: P1.periodStart })
  })

  it('replaces an ended subscription with a new paid one and resets usage', async () => {
    const db = memoryStore([stored({ stripe_subscription_id: 'sub_old', status: 'cancelled' })])
    const stripe = stripeState([remote('sub_old', 'canceled'), remote('sub_new', 'active', P2)])
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_new', userId: 'user-1', plan: 'business' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active', plan: 'business', builds_used: 0, current_period_start: P2.periodStart })
  })

  it('replaces a subscription the row still shows live once Stripe reports it ended', async () => {
    const db = memoryStore([stored({ stripe_subscription_id: 'sub_old', status: 'active' })])
    const stripe = stripeState([remote('sub_old', 'canceled'), remote('sub_new', 'active', P2)])
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_new' })
    expect(db.row().stripe_subscription_id).toBe('sub_new')
  })

  it('never switches between two live subscriptions', async () => {
    const db = memoryStore([stored({ stripe_subscription_id: 'sub_a', builds_used: 9 })])
    const stripe = stripeState([remote('sub_a', 'active'), remote('sub_b', 'active', P2)])
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_b' })).resolves.toEqual({ action: 'ignore', reason: 'duplicate_live_subscription', userId: 'user-1', keptSubscriptionId: 'sub_a', duplicateSubscriptionId: 'sub_b' })
    expect(db.row()).toMatchObject({ stripe_subscription_id: 'sub_a', builds_used: 9 })
  })

  it('makes the loser of two concurrent first attachments retry and then see the duplicate', async () => {
    const db = memoryStore([cardlessTrial()])
    const stripe = stripeState([remote('sub_a', 'active'), remote('sub_b', 'active')])
    const deps = { store: db.store, retrieve: stripe.retrieve }
    const rowSnapshot = { ...db.row() }
    // Both handlers read the row before either writes.
    const planA = planSubscriptionSync({ row: rowSnapshot, sub: (await stripe.retrieve('sub_a'))!, userId: 'user-1', plan: null })
    const planB = planSubscriptionSync({ row: rowSnapshot, sub: (await stripe.retrieve('sub_b'))!, userId: 'user-1', plan: null })
    expect(planA.action === 'update' && (await db.store.update(planA.expected, planA.values))).toBe('updated')
    expect(planB.action === 'update' && (await db.store.update(planB.expected, planB.values))).toBe('conflict')
    // Stripe retries B, which now sees A as the live subscription.
    await expect(syncSubscription(deps, { subscriptionId: 'sub_b' })).resolves.toMatchObject({ reason: 'duplicate_live_subscription' })
    expect(db.row().stripe_subscription_id).toBe('sub_a')
  })
})

describe('failure handling', () => {
  it('fails closed with a retryable error when the stored row cannot be read', async () => {
    const db = memoryStore([stored()], { failReads: true })
    const stripe = stripeState([remote('sub_1', 'canceled')])
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })).rejects.toBeInstanceOf(RetryableSyncError)
    expect(db.writes).toEqual([])
  })

  it('reports a concurrent change as retryable instead of overwriting it', async () => {
    const db = memoryStore([stored()])
    const stripe = stripeState([remote('sub_1', 'active', P2)])
    const store: BillingStore = { ...db.store, update: async () => 'conflict' }
    await expect(syncSubscription({ store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })).rejects.toBeInstanceOf(RetryableSyncError)
    expect(db.row().builds_used).toBe(7)
  })

  it('creates a row for an account without one only for an active subscription with a known plan', async () => {
    const stripe = stripeState([remote('sub_1', 'active', P1, { plan: null })])
    const db = memoryStore()
    await expect(syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1' })).resolves.toEqual({ action: 'ignore', reason: 'missing_plan' })
    await syncSubscription({ store: db.store, retrieve: stripe.retrieve }, { subscriptionId: 'sub_1', userId: 'user-1', plan: 'creator' })
    expect(db.row()).toMatchObject({ plan: 'creator', status: 'active', builds_used: 0 })
  })

  it('ignores an event for a subscription Stripe no longer has', async () => {
    const db = memoryStore([stored()])
    await expect(syncSubscription({ store: db.store, retrieve: async () => null }, { subscriptionId: 'sub_gone' })).resolves.toEqual({ action: 'ignore', reason: 'superseded' })
  })
})
