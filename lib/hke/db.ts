import type { Tables } from '@/types/database'

/**
 * Database row types for HKE, derived from the canonical types/database.ts.
 *
 * The only things defined here are the value sets enforced by CHECK
 * constraints (the type generator renders those columns as plain `string`)
 * and the narrowing of JSON columns HKE always stores as objects. Every
 * column name comes from the generated types, so a schema change that drops
 * or renames a column fails type-checking here.
 */

// CHECK-constrained value sets -------------------------------------------------

export type InterviewStatus = 'draft' | 'in-progress' | 'completed'
export type ProjectStatus = 'generating' | 'completed' | 'failed'
export type AssetStatus = 'generating' | 'completed' | 'failed'
export type EntitlementState = 'none' | 'reserved' | 'consumed' | 'released'
export type PlanId = 'creator' | 'professional' | 'business' | 'elite'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

/** A generated row with some columns narrowed. Overrides must name real columns. */
type Refine<Row, Overrides extends { [K in keyof Overrides]: K extends keyof Row ? unknown : never }> = Omit<Row, keyof Overrides> & Overrides

// Rows ---------------------------------------------------------------------------------------

export type InterviewRow = Refine<Tables<'interviews'>, { status: InterviewStatus }>

export type ProjectRow = Refine<Tables<'projects'>, { status: ProjectStatus; entitlement_state: EntitlementState; content: Record<string, unknown> }>

export type ProjectAssetRow = Refine<Tables<'project_assets'>, { status: AssetStatus; entitlement_state: EntitlementState; metadata: Record<string, unknown> }>

/** The subscription fields the app reads (see SUBSCRIPTION_COLUMNS). */
export type SubscriptionRow = Refine<
  Pick<Tables<'subscriptions'>, 'plan' | 'status' | 'interviews_used' | 'builds_used' | 'current_period_end' | 'trial_started_at' | 'stripe_subscription_id'>,
  { plan: PlanId; status: SubscriptionStatus }
>

// Select lists, checked against the generated column names ----------------------------

/** "a, b, c" as a literal type, so supabase-js can still parse the select list. */
type JoinColumns<Names extends readonly string[]> = Names extends readonly [infer First extends string, ...infer Rest extends string[]]
  ? Rest extends [] ? First : `${First}, ${JoinColumns<Rest>}`
  : string

function columns<Row>() {
  return <const Names extends readonly (keyof Row & string)[]>(...names: Names) => names.join(', ') as JoinColumns<Names>
}

export const PROJECT_COLUMNS = columns<Tables<'projects'>>()('id', 'user_id', 'interview_id', 'title', 'content', 'status', 'archived_at', 'entitlement_state', 'created_at', 'updated_at')
export const ASSET_COLUMNS = columns<Tables<'project_assets'>>()('id', 'project_id', 'user_id', 'asset_type', 'title', 'content', 'status', 'version', 'metadata', 'error_message', 'entitlement_state', 'created_at', 'updated_at')
/** Asset listing without the (potentially large) content body. */
export const ASSET_SUMMARY_COLUMNS = columns<Tables<'project_assets'>>()('id', 'project_id', 'asset_type', 'title', 'status', 'version', 'error_message', 'created_at', 'updated_at')
export const SUBSCRIPTION_COLUMNS = columns<Tables<'subscriptions'>>()('plan', 'status', 'interviews_used', 'builds_used', 'current_period_end', 'trial_started_at', 'stripe_subscription_id')
