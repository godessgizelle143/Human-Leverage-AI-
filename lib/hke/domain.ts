/**
 * HKE AI domain model.
 *
 *   Human knowledge → Knowledge capture → Knowledge engine → Intelligence
 *   → Build engine → Asset engine → Execution engine → Deployment
 *
 * Implemented today: capture (the interview), the knowledge engine (assembled
 * from saved interview answers, blueprint, and plan steps), intelligence
 * (structured LLM generation with schema validation), and the asset engine
 * (project_assets; rows typed in ./db from types/database.ts). Build and execution are declared here as contracts only,
 * so they can be added without reshaping the rest of the system.
 */

import type { PlanId } from './db'

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

/** Where a piece of knowledge came from. Documents and URLs are future kinds. */
export type KnowledgeSourceKind = 'interview' | 'blueprint' | 'plan_step' | 'document' | 'url'

export type KnowledgeSource = {
  id: string
  kind: KnowledgeSourceKind
  label: string
}

/**
 * One unit of knowledge. `answer` is the founder's own words, `insight` is
 * structured knowledge extracted by HKE (the blueprint), and `plan` is a
 * decision the founder recorded in a launch step.
 */
export type KnowledgeItemKind = 'answer' | 'insight' | 'plan'

export type KnowledgeItem = {
  key: string
  kind: KnowledgeItemKind
  sourceId: string
  label: string
  text: string
}

export type Knowledge = {
  projectId: string
  title: string
  sources: KnowledgeSource[]
  items: KnowledgeItem[]
}

/** Produces the knowledge HKE holds for a project. */
export interface KnowledgeEngine {
  forProject(projectId: string): Promise<Knowledge | null>
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export type AssetCategory = 'content' | 'marketing' | 'education' | 'brand' | 'document'

export type AssetTypeDefinition = {
  /** Stored in project_assets.asset_type; must match ^[a-z0-9_]{1,64}$. */
  id: string
  label: string
  category: AssetCategory
  description: string
  instructions: string
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

export type CreditKind = 'interview' | 'build'

export type CreditUsage = { used: number; limit: number | null; remaining: number | null }

export type Usage = {
  plan: PlanId | 'owner'
  planLabel: string
  active: boolean
  trialing: boolean
  periodEnd: string | null
  interviews: CreditUsage
  builds: CreditUsage
}

// ---------------------------------------------------------------------------
// Build engine (contract only)
// ---------------------------------------------------------------------------

export type BuildTargetKind =
  | 'website'
  | 'web_app'
  | 'mobile_app'
  | 'ai_app'
  | 'internal_tool'
  | 'api'
  | 'automation'
  | 'workflow'
  | 'dashboard'
  | 'business_system'

export type BuildPlan = {
  target: BuildTargetKind
  summary: string
  steps: { title: string; detail: string }[]
}

/** Turns knowledge into buildable things. Implementations will persist to a build_jobs table. */
export interface BuildEngine {
  plan(knowledge: Knowledge, target: BuildTargetKind): Promise<BuildPlan>
}

// ---------------------------------------------------------------------------
// Execution engine (contract only)
// ---------------------------------------------------------------------------

export type ExecutionTrigger = { kind: 'manual' } | { kind: 'schedule'; cron: string } | { kind: 'event'; event: string }

export type ExecutionAction = {
  kind: 'agent' | 'workflow' | 'publish' | 'notify' | 'integration'
  name: string
  input: Record<string, unknown>
}

/**
 * Runs actions on the user's behalf. It receives knowledge and assets as
 * inputs and never depends on builder UI state.
 */
export interface ExecutionEngine {
  run(action: ExecutionAction, trigger: ExecutionTrigger): Promise<{ runId: string }>
}
