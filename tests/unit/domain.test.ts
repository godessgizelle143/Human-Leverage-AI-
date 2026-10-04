import { describe, expect, it } from 'vitest'
import { PRICING_PLANS } from '@/lib/stripe/client'
import { ASSET_TYPES, displayStatus } from '@/lib/hke/assets'
import { ASSET_COLUMNS, ASSET_SUMMARY_COLUMNS, PROJECT_COLUMNS, SUBSCRIPTION_COLUMNS } from '@/lib/hke/db'
import { canGenerateAsset, canGenerateBlueprint, denialToError, PLAN_LIMITS, usageFor } from '@/lib/hke/entitlements'
import { BlueprintOutputSchema } from '@/lib/hke/intelligence/schemas'
import { parseInterviewMessages, sanitizeAnswers, serializeInterviewMessages } from '@/lib/hke/interview'
import { assembleKnowledge, knowledgeToPromptContext } from '@/lib/hke/knowledge'
import { deriveLifecycle } from '@/lib/hke/lifecycle'
import { getStep, parseStepInput } from '@/lib/hke/steps'

const future = new Date(Date.now() + 86400000).toISOString()
const past = new Date(Date.now() - 1000).toISOString()

describe('select lists', () => {
  it('produce the same column lists as before deriving them from types/database.ts', () => {
    expect(PROJECT_COLUMNS).toBe('id, user_id, interview_id, title, content, status, archived_at, entitlement_state, created_at, updated_at')
    expect(ASSET_COLUMNS).toBe('id, project_id, user_id, asset_type, title, content, status, version, metadata, error_message, entitlement_state, created_at, updated_at')
    expect(ASSET_SUMMARY_COLUMNS).toBe('id, project_id, asset_type, title, status, version, error_message, created_at, updated_at')
    expect(SUBSCRIPTION_COLUMNS).toBe('plan, status, interviews_used, builds_used, current_period_end, trial_started_at')
  })
})

describe('entitlements', () => {
  it('advertises the same limits the database enforces', () => {
    for (const key of ['creator', 'professional', 'business'] as const) {
      expect(PRICING_PLANS[key].interviews).toBe(PLAN_LIMITS[key].interviews)
      expect(PRICING_PLANS[key].builds).toBe(PLAN_LIMITS[key].builds)
    }
    expect(PLAN_LIMITS.elite).toMatchObject({ interviews: null, builds: null })
  })

  it('computes remaining credits and access from the subscription row', () => {
    const usage = usageFor({ plan: 'professional', status: 'trialing', interviews_used: 3, builds_used: 15, current_period_end: future, trial_started_at: null }, false)
    expect(usage).toMatchObject({ active: true, trialing: true, interviews: { remaining: 12 }, builds: { remaining: 0 } })
    expect(canGenerateBlueprint(usage)).toBe(false)
    expect(canGenerateAsset(usage)).toBe(false)

    const expired = usageFor({ plan: 'creator', status: 'active', interviews_used: 0, builds_used: 0, current_period_end: past, trial_started_at: null }, false)
    expect(expired?.active).toBe(false)
    expect(canGenerateAsset(expired)).toBe(false)

    expect(usageFor(null, false)).toBeNull()
    expect(canGenerateAsset(usageFor(null, true))).toBe(true)
  })

  it('treats elite as unlimited', () => {
    const usage = usageFor({ plan: 'elite', status: 'active', interviews_used: 400, builds_used: 900, current_period_end: null, trial_started_at: null }, false)
    expect(usage?.builds.remaining).toBeNull()
    expect(canGenerateBlueprint(usage)).toBe(true)
  })

  it('maps every denial to a safe message and status', () => {
    expect(denialToError('no_subscription').status).toBe(403)
    expect(denialToError('project_archived').status).toBe(409)
    expect(denialToError('interview_not_found').status).toBe(404)
    expect(denialToError('something-new').status).toBe(500)
  })
})

describe('blueprint schema', () => {
  it('requires the anchor fields and strips unknown keys', () => {
    expect(BlueprintOutputSchema.safeParse({ elevator_pitch: 'x' }).success).toBe(false)
    const parsed = BlueprintOutputSchema.parse({ business_summary: 'a', elevator_pitch: 'b', extra: 'c' })
    expect(parsed).not.toHaveProperty('extra')
    expect(parsed.recommended_modules).toEqual([])
  })

  it('rejects non-text values and oversized output', () => {
    expect(BlueprintOutputSchema.safeParse({ business_summary: 'a', elevator_pitch: 'b', brand_voice: 42 }).success).toBe(false)
    expect(BlueprintOutputSchema.safeParse({ business_summary: 'a', elevator_pitch: 'b', next_steps: Array.from({ length: 40 }, () => 'x'.repeat(4000)) }).success).toBe(false)
  })
})

describe('asset catalog', () => {
  it('uses ids that satisfy the project_assets.asset_type constraint', () => {
    for (const type of ASSET_TYPES) expect(type.id).toMatch(/^[a-z0-9_]{1,64}$/)
    expect(new Set(ASSET_TYPES.map((type) => type.id)).size).toBe(ASSET_TYPES.length)
  })

  it('shows long-running generations as interrupted', () => {
    expect(displayStatus({ status: 'generating', updated_at: new Date().toISOString() })).toBe('generating')
    expect(displayStatus({ status: 'generating', updated_at: new Date(Date.now() - 6 * 60000).toISOString() })).toBe('interrupted')
  })
})

describe('steps', () => {
  it('maps request fields to the stored keys used by existing data', () => {
    const result = parseStepInput(getStep('launch_target'), { audience: ' Bakers ', location: 'Austin', offer: 'Coaching', milestone: '10 clients' })
    expect(result).toEqual({ ok: true, value: { audience: 'Bakers', location: 'Austin', offer: 'Coaching', first_milestone: '10 clients' } })
  })

  it('requires every field, caps length, and adds fixed extras', () => {
    expect(parseStepInput(getStep('customer_offer'), { serviceName: 'x' }).ok).toBe(false)
    const tooLong = parseStepInput(getStep('launch_target'), { audience: 'x'.repeat(6000), location: 'a', offer: 'b', milestone: 'c' })
    expect(tooLong).toMatchObject({ ok: false, message: expect.stringContaining('5000') })
    const content = parseStepInput(getStep('launch_content'), { launchGoal: 'a', audience: 'b', channels: 'c', callToAction: 'd' })
    expect(content.ok && content.value.plan).toBeTruthy()
  })
})

describe('interview + knowledge', () => {
  it('reads legacy and versioned interview shapes and drops unknown questions', () => {
    expect(parseInterviewMessages({ 1: 'Legacy', 99: 'ignored' })).toEqual({ answers: { 1: 'Legacy' }, current: 0, archived: false })
    expect(parseInterviewMessages(serializeInterviewMessages({ answers: { 2: 'New' }, current: 4, archived: true }))).toEqual({ answers: { 2: 'New' }, current: 4, archived: true })
    expect(sanitizeAnswers({ 1: 'x'.repeat(20000) })['1']).toHaveLength(10000)
  })

  it('assembles blueprint, plan, and interview knowledge in one context', () => {
    const knowledge = assembleKnowledge(
      { id: 'p', title: 'Crumb & Co', content: { business_summary: 'Pricing coaching', launch_target: { audience: 'Bakers' }, recommended_modules: ['x'], generation: { model: 'm' } } },
      { 1: 'Crumb & Co' },
    )
    expect(knowledge.sources.map((source) => source.kind)).toEqual(['blueprint', 'plan_step', 'interview'])
    const context = knowledgeToPromptContext(knowledge)
    expect(context).toContain('Pricing coaching')
    expect(context).toContain('Bakers')
    expect(context).not.toContain('recommended_modules')
    expect(knowledgeToPromptContext(knowledge, 40)).toContain('[context truncated]')
  })
})

describe('lifecycle', () => {
  const now = new Date().toISOString()
  it('derives stage from saved state', () => {
    expect(deriveLifecycle({ status: 'draft', messages: {} }, null)).toBe('draft')
    expect(deriveLifecycle({ status: 'in-progress', messages: { 1: 'a' } }, null)).toBe('interviewing')
    expect(deriveLifecycle({ status: 'completed', messages: { 1: 'a' } }, { status: 'generating', archived_at: null })).toBe('knowledge_extracted')
    expect(deriveLifecycle(null, { status: 'completed', archived_at: null })).toBe('blueprint_created')
    expect(deriveLifecycle(null, { status: 'completed', archived_at: null }, [{ status: 'generating', updated_at: now }])).toBe('assets_generating')
    expect(deriveLifecycle(null, { status: 'completed', archived_at: null }, [{ status: 'completed', updated_at: now }])).toBe('assets_ready')
    expect(deriveLifecycle(null, { status: 'completed', archived_at: now })).toBe('archived')
  })
})
