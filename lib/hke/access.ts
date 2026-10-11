import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isOwnerUser } from '@/lib/owner-access'
import { SUBSCRIPTION_COLUMNS, type SubscriptionRow } from './db'
import { usageFor } from './entitlements'

/**
 * Read-only view of the signed-in user's plan and remaining credits. It never
 * consumes anything; the database functions are the only place credits move.
 */
export async function getUserUsage(supabase: SupabaseClient, user: User) {
  const isOwner = isOwnerUser(user)
  const { data } = await supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('user_id', user.id).maybeSingle()
  const subscription = (data as SubscriptionRow | null) ?? null
  return { isOwner, subscription, usage: usageFor(subscription, isOwner) }
}
