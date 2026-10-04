import type { PlanId, SubscriptionRow } from './db'
import type { CreditUsage, Usage } from './domain'
import { HkeError } from './errors'

/**
 * Mirrors the limits enforced by the database: try_consume_generation
 * (20260905061018) and try_consume_build (20261004120000). The database is the
 * authority; these values only drive what the UI says.
 *
 * - A blueprint uses 1 interview credit + 1 build credit.
 * - A generated asset uses 1 build credit.
 * - A failed generation returns its credits.
 */
export const PLAN_LIMITS: Record<PlanId, { label: string; interviews: number | null; builds: number | null }> = {
  creator: { label: 'Creator', interviews: 5, builds: 5 },
  professional: { label: 'Professional', interviews: 15, builds: 15 },
  business: { label: 'Business Pro', interviews: 25, builds: 25 },
  elite: { label: 'Elite', interviews: null, builds: null },
}

/** start_trial(): a Professional plan, trialing, for three days. */
export const TRIAL = { plan: 'professional' as const, days: 3 }

function credit(used: number, limit: number | null): CreditUsage {
  return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) }
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLAN_LIMITS
}

export function usageFor(subscription: SubscriptionRow | null | undefined, isOwner: boolean, now = new Date()): Usage | null {
  if (isOwner) {
    return { plan: 'owner', planLabel: 'Owner', active: true, trialing: false, periodEnd: null, interviews: credit(subscription?.interviews_used ?? 0, null), builds: credit(subscription?.builds_used ?? 0, null) }
  }
  if (!subscription || !isPlanId(subscription.plan)) return null
  const limits = PLAN_LIMITS[subscription.plan]
  const expired = !!subscription.current_period_end && new Date(subscription.current_period_end) <= now
  return {
    plan: subscription.plan,
    planLabel: limits.label,
    active: ['active', 'trialing'].includes(subscription.status) && !expired,
    trialing: subscription.status === 'trialing',
    periodEnd: subscription.current_period_end,
    interviews: credit(subscription.interviews_used, limits.interviews),
    builds: credit(subscription.builds_used, limits.builds),
  }
}

/** True when the user can start a blueprint (both credits available). */
export function canGenerateBlueprint(usage: Usage | null) {
  return !!usage?.active && usage.interviews.remaining !== 0 && usage.builds.remaining !== 0
}

/** True when the user can generate an asset (a build credit available). */
export function canGenerateAsset(usage: Usage | null) {
  return !!usage?.active && usage.builds.remaining !== 0
}

export type DenialReason =
  | 'no_subscription'
  | 'interview_limit'
  | 'build_limit'
  | 'both_limits'
  | 'interview_not_found'
  | 'project_not_found'
  | 'project_exists'
  | 'project_archived'
  | 'generation_in_progress'

export type DenialDetails = {
  plan?: string | null
  interviewLimit?: number | null
  buildLimit?: number | null
  projectId?: string | null
}

function planLabel(plan: string | null | undefined) {
  return isPlanId(plan) ? PLAN_LIMITS[plan].label : 'current'
}

const count = (limit: number | null | undefined) => (typeof limit === 'number' ? ` ${limit}` : '')

/** Maps a denial from hke_begin_* to a clear, user-safe error. */
export function denialToError(reason: string, details: DenialDetails = {}): HkeError {
  const label = planLabel(details.plan)
  switch (reason as DenialReason) {
    case 'no_subscription':
      return new HkeError('no_subscription', 'An active plan or trial is required. Choose a plan on your dashboard to keep building.')
    case 'interview_limit':
    case 'both_limits':
      return new HkeError('limit_reached', `You've used all${count(details.interviewLimit)} blueprint generations on your ${label} plan for this period.`)
    case 'build_limit':
      return new HkeError('limit_reached', `You've used all${count(details.buildLimit)} build credits on your ${label} plan for this period.`)
    case 'interview_not_found':
      return new HkeError('not_found', 'This interview could not be found. Please reopen it from your dashboard.')
    case 'project_not_found':
      return new HkeError('not_found', 'Project not found.')
    case 'project_exists':
      return new HkeError('conflict', 'A blueprint already exists for this interview.', { projectId: details.projectId ?? null })
    case 'project_archived':
      return new HkeError('archived', 'Restore this project before generating new assets.')
    case 'generation_in_progress':
      return new HkeError('generation_in_progress', 'A generation is already running for this project. Please wait for it to finish.', { projectId: details.projectId ?? null })
    default:
      return new HkeError('internal', 'Unable to start generation. Please try again.')
  }
}
