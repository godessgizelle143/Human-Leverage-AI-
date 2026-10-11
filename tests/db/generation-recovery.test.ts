import type { SupabaseClient } from '@supabase/supabase-js'
import { APIConnectionTimeoutError } from 'openai'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getAssetType } from '@/lib/hke/assets'
import { HkeError } from '@/lib/hke/errors'
import { generateAsset, generateBlueprint } from '@/lib/hke/generation/services'
import { supabaseGenerationStore } from '@/lib/hke/generation/store'
import { openAIProvider, type IntelligenceProvider } from '@/lib/hke/intelligence/provider'
import { assembleKnowledge } from '@/lib/hke/knowledge'
import { getOpenAIClient } from '@/lib/openai/client'
import { age, createTestDb, seedProject, seedUser, usage, type TestDb } from './harness'

/**
 * The real generation services and the real database functions from the
 * migrations, on PGlite, with the model replaced by a test double. PGlite is
 * one connection, so "at the same time" here means interleaved calls, not
 * overlapping transactions. No request is sent to OpenAI.
 */
let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
  vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real')
})

afterEach(() => {
  vi.restoreAllMocks()
})

const TABLE_FUNCTIONS = new Set(['hke_begin_blueprint_generation', 'hke_begin_asset_generation'])

/** The slice of the service-role client the generation store uses. */
function serviceClient() {
  const run = async (fn: string, args: Record<string, unknown>) => {
    try {
      await t.asService()
      const names = Object.keys(args)
      const values = Object.values(args).map((value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value))
      const rows = await t.query<Record<string, unknown>>(`select * from public.${fn}(${names.map((name, index) => `${name} => $${index + 1}`).join(', ')})`, values)
      return { data: TABLE_FUNCTIONS.has(fn) ? rows[0] ?? null : rows[0]?.[fn] ?? null, error: null }
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      const pending = run(fn, args)
      return Object.assign(pending, { single: () => pending })
    },
  }
  return client as unknown as SupabaseClient
}

const VALID_BLUEPRINT = JSON.stringify({ business_summary: 'We teach small bakeries to price for profit.', elevator_pitch: 'Profit-first pricing for bakeries.', recommended_modules: [] })
const VALID_ASSET = JSON.stringify({ title: 'Profit-First Pricing FAQ', content_markdown: '# FAQ\n\n## Pricing\n\n- How do I price a loaf? Start with your true cost per unit.' })
const answers = { '1': 'Crumb & Co', '2': 'Pricing coaching for bakeries' }
const interview = { answers, current: 14, archived: false }

function fakeProvider(text: string, gate?: Promise<void>): IntelligenceProvider {
  return {
    isConfigured: () => true,
    async completeJson() {
      if (gate) await gate
      return { text, truncated: false, model: 'test-model' }
    },
  }
}

async function saveAnswers(interviewId: string) {
  await t.asSuperuser()
  await t.query('update public.interviews set messages = $2 where id = $1', [interviewId, JSON.stringify({ version: 2, ...interview })])
}

async function projectsFor(interviewId: string) {
  await t.asSuperuser()
  return t.query<{ id: string; status: string; entitlement_state: string }>('select id, status, entitlement_state from public.projects where interview_id = $1', [interviewId])
}

async function storedAnswers(interviewId: string) {
  await t.asSuperuser()
  return (await t.one<{ messages: { answers: Record<string, string> } }>('select messages from public.interviews where id = $1', [interviewId])).messages.answers
}

function build(userId: string, interviewId: string, provider: IntelligenceProvider) {
  return generateBlueprint({ store: supabaseGenerationStore(serviceClient()), provider }, { userId, interviewId, title: 'Crumb & Co', interview, skipEntitlement: false })
}

describe('blueprint builds: fresh, stale, and timed out', () => {
  it('blocks a duplicate build while a fresh one is generating, and charges once', async () => {
    const { userId, interviewId } = await seedUser(t)
    let finishFirst!: () => void
    const gate = new Promise<void>((resolve) => { finishFirst = resolve })

    const first = build(userId, interviewId, fakeProvider(VALID_BLUEPRINT, gate))
    await vi.waitFor(async () => expect(await projectsFor(interviewId)).toHaveLength(1))
    const [running] = await projectsFor(interviewId)
    expect(running.status).toBe('generating')

    const duplicate = await build(userId, interviewId, fakeProvider(VALID_BLUEPRINT)).catch((error) => error)
    expect(duplicate).toBeInstanceOf(HkeError)
    expect((duplicate as HkeError).code).toBe('generation_in_progress')
    expect((duplicate as HkeError).details).toMatchObject({ projectId: running.id })
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })

    finishFirst()
    await expect(first).resolves.toEqual({ projectId: running.id })
    expect(await projectsFor(interviewId)).toEqual([{ id: running.id, status: 'completed', entitlement_state: 'consumed' }])
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
  })

  it('rebuilds a stale generating project, keeping the answers and charging once in total', async () => {
    const { userId, interviewId } = await seedUser(t)
    await saveAnswers(interviewId)

    // A build that was cut off: the claim exists, nothing ever settled it.
    const store = supabaseGenerationStore(serviceClient())
    const interrupted = await store.beginBlueprint({ userId, interviewId, projectId: '00000000-0000-4000-8000-00000000dead', title: 'Crumb & Co', skipEntitlement: false })
    expect(interrupted).toMatchObject({ ok: true })
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
    await age(t, 'projects', '00000000-0000-4000-8000-00000000dead', 10)

    const rebuilt = await build(userId, interviewId, fakeProvider(VALID_BLUEPRINT))

    const projects = await projectsFor(interviewId)
    expect(projects).toEqual([{ id: rebuilt.projectId, status: 'completed', entitlement_state: 'consumed' }])
    expect(rebuilt.projectId).not.toBe('00000000-0000-4000-8000-00000000dead')
    // The interrupted credit was returned and the rebuild charged: one in total.
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
    expect(await storedAnswers(interviewId)).toEqual(answers)

    // The interrupted request finishing late settles nothing and refunds nothing.
    expect(await store.finishBlueprint({ userId, projectId: '00000000-0000-4000-8000-00000000dead', succeeded: false })).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
    expect(await projectsFor(interviewId)).toHaveLength(1)
  })

  it('does not rebuild a generating project that is still inside the five-minute window', async () => {
    const { userId, interviewId } = await seedUser(t)
    const store = supabaseGenerationStore(serviceClient())
    await store.beginBlueprint({ userId, interviewId, projectId: '00000000-0000-4000-8000-00000000f4e5', title: 'Crumb & Co', skipEntitlement: false })
    await age(t, 'projects', '00000000-0000-4000-8000-00000000f4e5', 4)

    const attempt = await build(userId, interviewId, fakeProvider(VALID_BLUEPRINT)).catch((error) => error)
    expect((attempt as HkeError).code).toBe('generation_in_progress')
    expect(await projectsFor(interviewId)).toEqual([{ id: '00000000-0000-4000-8000-00000000f4e5', status: 'generating', entitlement_state: 'reserved' }])
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
  })

  it('on a provider timeout returns the credit once, leaves no generating project, and says what happened', async () => {
    const { userId, interviewId } = await seedUser(t, { interviewsUsed: 3, buildsUsed: 3 })
    await saveAnswers(interviewId)
    vi.spyOn(getOpenAIClient().chat.completions, 'create').mockRejectedValue(new APIConnectionTimeoutError())
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const failure = await build(userId, interviewId, openAIProvider).catch((error) => error)

    expect(failure).toBeInstanceOf(HkeError)
    expect((failure as HkeError).code).toBe('ai_timeout')
    expect((failure as HkeError).message).toMatch(/took too long/i)
    // Nothing is left in `generating`, so the customer can build again straight away.
    expect(await projectsFor(interviewId)).toEqual([])
    // Exactly the reserved credit came back: 3 and 3, not 2 and 2.
    expect(await usage(t, userId)).toEqual({ interviews_used: 3, builds_used: 3 })
    expect(await storedAnswers(interviewId)).toEqual(answers)

    // The next attempt succeeds and is charged once.
    vi.restoreAllMocks()
    const retry = await build(userId, interviewId, fakeProvider(VALID_BLUEPRINT))
    expect(await projectsFor(interviewId)).toEqual([{ id: retry.projectId, status: 'completed', entitlement_state: 'consumed' }])
    expect(await usage(t, userId)).toEqual({ interviews_used: 4, builds_used: 4 })
  })

  it('refuses to build from an interview that belongs to someone else, timeout policy or not', async () => {
    const owner = await seedUser(t)
    const other = await seedUser(t)
    const attempt = await build(other.userId, owner.interviewId, fakeProvider(VALID_BLUEPRINT)).catch((error) => error)
    expect(attempt).toBeInstanceOf(HkeError)
    expect(await projectsFor(owner.interviewId)).toEqual([])
    expect(await usage(t, other.userId)).toEqual({ interviews_used: 0, builds_used: 0 })
  })
})

describe('asset generation on a provider timeout', () => {
  it('records the failure, returns the build credit once, and keeps the project and earlier assets', async () => {
    const { userId, interviewId } = await seedUser(t, { buildsUsed: 2 })
    const projectId = await seedProject(t, userId, interviewId)
    const store = supabaseGenerationStore(serviceClient())
    const knowledge = assembleKnowledge({ id: projectId, title: 'Test project', content: { business_summary: 'Test' } }, answers)
    const type = getAssetType('faq')!

    const earlier = await generateAsset({ store, provider: fakeProvider(VALID_ASSET) }, { userId, projectId, type, knowledge, skipEntitlement: false })
    expect(await usage(t, userId)).toMatchObject({ builds_used: 3 })

    vi.spyOn(getOpenAIClient().chat.completions, 'create').mockRejectedValue(new APIConnectionTimeoutError())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = await generateAsset({ store, provider: openAIProvider }, { userId, projectId, type, knowledge, skipEntitlement: false }).catch((error) => error)

    expect((failure as HkeError).code).toBe('ai_timeout')
    await t.asSuperuser()
    const assets = await t.query<{ id: string; status: string; error_message: string | null; content: string }>('select id, status, error_message, content from public.project_assets where project_id = $1 order by version', [projectId])
    expect(assets.map((asset) => asset.status)).toEqual(['completed', 'failed'])
    expect(assets[0]).toMatchObject({ id: earlier.assetId, status: 'completed' })
    expect(assets[0].content).toContain('How do I price a loaf?')
    expect(assets[1].error_message).toMatch(/took too long/i)
    expect(await usage(t, userId)).toMatchObject({ builds_used: 3 }) // the timed-out build was returned, once
    expect((await t.one<{ status: string }>('select status from public.projects where id = $1', [projectId])).status).toBe('completed')
  })
})
