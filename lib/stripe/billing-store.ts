import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { CheckoutLock, CustomerClaim } from './checkout'
import { classifyZeroRowUpdate, RetryableSyncError, UnexpectedWriteError, type BillingRow, type BillingStore } from './sync'

const ROW_COLUMNS = 'user_id, stripe_customer_id, stripe_subscription_id, status, current_period_start'

/** BillingStore over the subscriptions table. Needs a service-role client (clients cannot write it). */
export function supabaseBillingStore(supabase: SupabaseClient<Database>): BillingStore {
  async function findBy(column: 'user_id' | 'stripe_customer_id', value: string): Promise<BillingRow | null> {
    const { data, error } = await supabase.from('subscriptions').select(ROW_COLUMNS).eq(column, value).maybeSingle()
    // Fail closed: without the stored state we cannot tell a stale event from a new one.
    if (error) throw new RetryableSyncError(`Subscription read failed: ${error.message}`)
    return data
  }

  return {
    findByUserId: (userId) => findBy('user_id', userId),
    findByCustomerId: (customerId) => findBy('stripe_customer_id', customerId),

    async insert(userId, values) {
      const { error } = await supabase.from('subscriptions').insert({ user_id: userId, ...values, updated_at: new Date().toISOString() })
      if (!error) return 'inserted'
      if (error.code === '23505') return 'conflict'
      throw new RetryableSyncError(`Subscription insert failed: ${error.message}`)
    },

    async update(expected, values) {
      let query = supabase.from('subscriptions').update({ ...values, updated_at: new Date().toISOString() }).eq('user_id', expected.userId)
      query = expected.subscriptionId ? query.eq('stripe_subscription_id', expected.subscriptionId) : query.is('stripe_subscription_id', null)
      query = expected.periodStart ? query.eq('current_period_start', expected.periodStart) : query.is('current_period_start', null)
      const { data, error } = await query.select('user_id')
      if (error) throw new RetryableSyncError(`Subscription update failed: ${error.message}`)
      if (data?.length) return 'updated'

      // Zero rows: only a changed row is a genuine concurrent conflict.
      const current = await findBy('user_id', expected.userId)
      const reason = classifyZeroRowUpdate(expected, current)
      if (reason === 'conflict') return 'conflict'
      throw new UnexpectedWriteError(
        reason === 'missing'
          ? `Conditional subscription update matched no rows: row for ${expected.userId} is missing`
          : `Conditional subscription update matched no rows but the row still has subscription ${expected.subscriptionId ?? 'null'} and period ${expected.periodStart ?? 'null'} (check service-role key, RLS, and filter encoding)`,
      )
    },
  }
}

/**
 * CustomerClaim over claim_stripe_customer: first writer wins, and a request
 * that lost gets the stored winner back from the same call. Needs a
 * service-role client. An error throws: the outcome is then unknown, so the
 * caller must not assume the claim failed.
 */
export function supabaseCustomerClaim(supabase: SupabaseClient<Database>): CustomerClaim {
  return {
    async claim(userId, customerId) {
      const { data, error } = await supabase.rpc('claim_stripe_customer', { p_user_id: userId, p_customer_id: customerId })
      if (error) throw new Error(`Stripe customer claim failed: ${error.message}`)
      const row = data?.[0]
      if (!row) return null // the account has no subscriptions row
      // Whether the claim was won or lost, the stored id is the one to use.
      return row.stored_customer_id ?? null
    },
  }
}

/**
 * CheckoutLock over checkout_locks. Needs a service-role client. Every error
 * throws, so a lock that cannot be confirmed is never treated as held.
 */
export function supabaseCheckoutLock(supabase: SupabaseClient<Database>): CheckoutLock {
  return {
    async acquire(userId, token, leaseSeconds) {
      const { data, error } = await supabase.rpc('acquire_checkout_lock', { p_user_id: userId, p_token: token, p_lease_seconds: leaseSeconds })
      if (error) throw new Error(`Checkout lock acquire failed: ${error.message}`)
      return data === true
    },
    async renew(userId, token, leaseSeconds) {
      const { data, error } = await supabase.rpc('renew_checkout_lock', { p_user_id: userId, p_token: token, p_lease_seconds: leaseSeconds })
      if (error) throw new Error(`Checkout lock renew failed: ${error.message}`)
      return data === true
    },
    async release(userId, token) {
      const { error } = await supabase.rpc('release_checkout_lock', { p_user_id: userId, p_token: token })
      if (error) throw new Error(`Checkout lock release failed: ${error.message}`)
    },
  }
}
