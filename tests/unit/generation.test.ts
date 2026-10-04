import { describe, expect, it, vi } from 'vitest'
import { getAssetType } from '@/lib/hke/assets'
import { HkeError } from '@/lib/hke/errors'
import type { GenerationStore, Settlement } from '@/lib/hke/generation/store'
import { generateAsset, generateBlueprint } from '@/lib/hke/generation/services'
import { IntelligenceError, type IntelligenceProvider } from '@/lib/hke/intelligence/provider'
import { assembleKnowledge } from '@/lib/hke/knowledge'

const VALID_BLUEPRINT = JSON.stringify({
  business_summary: 'We teach small bakeries to price for profit.',
  elevator_pitch: 'Profit-first pricing for bakeries.',
  ideal_customer: ['Owner-operated bakeries', 'Under 10 staff'],
  brand_voice: { tone: 'Warm', style: 'Practical' },
  recommended_modules: ['not-a-real-module'],
  injected_key: 'should be stripped',
})

const VALID_ASSET = JSON.stringify({ title: 'Profit-First Pricing FAQ', content_markdown: '# FAQ\n\n## Pricing\n\n- How do I price a loaf? Start with your true cost per unit.' })

function provider(response: string | Error, truncated = false): IntelligenceProvider {
  return {
    isConfigured: () => true,
    completeJson: vi.fn(async () => {
      if (response instanceof Error) throw response
      return { text: response, truncated, model: 'test-model' }
    }),
  }
}

/** In-memory store that records every credit movement the services cause. */
function memoryStore(options: { denial?: { reason: string; plan?: string; interviewLimit?: number; buildLimit?: number; projectId?: string }; settlement?: Settlement } = {}) {
  const calls = { begin: 0, finish: [] as { succeeded: boolean; error?: string; content?: unknown; title?: string }[] }
  const settle = (succeeded: boolean): Settlement => options.settlement !== undefined ? options.settlement : succeeded ? 'completed' : 'failed'
  const denial = options.denial
  const store: GenerationStore = {
    async beginBlueprint(input) {
      calls.begin += 1
      return denial ? { ok: false, reason: denial.reason, details: denial } : { ok: true, projectId: input.projectId }
    },
    async finishBlueprint(input) {
      calls.finish.push({ succeeded: input.succeeded, content: input.content })
      return settle(input.succeeded)
    },
    async beginAsset() {
      calls.begin += 1
      return denial ? { ok: false, reason: denial.reason, details: denial } : { ok: true, assetId: 'asset-1', version: 1 }
    },
    async finishAsset(input) {
      calls.finish.push({ succeeded: input.succeeded, error: input.error, content: input.content, title: input.title })
      return settle(input.succeeded)
    },
  }
  return { store, calls }
}

const interview = { answers: { '1': 'Crumb & Co', '2': 'Pricing coaching for bakeries' }, current: 14, archived: false }
const blueprintInput = { userId: 'user-1', interviewId: 'interview-1', title: 'Crumb & Co', interview, skipEntitlement: false }

describe('generateBlueprint', () => {
  it('settles success exactly once and stores only validated, allow-listed content', async () => {
    const { store, calls } = memoryStore()
    const result = await generateBlueprint({ store, provider: provider(VALID_BLUEPRINT), newId: () => 'project-1' }, blueprintInput)
    expect(result).toEqual({ projectId: 'project-1' })
    expect(calls.begin).toBe(1)
    expect(calls.finish).toHaveLength(1)
    expect(calls.finish[0].succeeded).toBe(true)
    const content = calls.finish[0].content as Record<string, unknown>
    expect(content.recommended_modules).toEqual([])
    expect(content).not.toHaveProperty('injected_key')
    expect(content.generation).toMatchObject({ model: 'test-model', prompt_version: 1 })
  })

  it('maps denials to clear errors without calling the model', async () => {
    const ai = provider(VALID_BLUEPRINT)
    const { store, calls } = memoryStore({ denial: { reason: 'interview_limit', plan: 'professional', interviewLimit: 15 } })
    await expect(generateBlueprint({ store, provider: ai }, blueprintInput)).rejects.toMatchObject({ code: 'limit_reached', message: "You've used all 15 blueprint generations on your Professional plan for this period." })
    expect(ai.completeJson).not.toHaveBeenCalled()
    expect(calls.finish).toHaveLength(0)
  })

  it('returns a conflict with the existing project id for duplicate requests', async () => {
    const { store } = memoryStore({ denial: { reason: 'project_exists', projectId: 'project-9' } })
    const error: unknown = await generateBlueprint({ store, provider: provider(VALID_BLUEPRINT) }, blueprintInput).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HkeError)
    expect((error as HkeError).status).toBe(409)
    expect((error as HkeError).details).toEqual({ projectId: 'project-9' })
  })

  it.each([
    ['unparseable JSON', provider('not json')],
    ['schema violation', provider(JSON.stringify({ business_summary: '', elevator_pitch: 'x' }))],
    ['truncated output', provider(VALID_BLUEPRINT, true)],
  ])('rejects %s and releases the reservation once', async (_label, ai) => {
    const { store, calls } = memoryStore()
    await expect(generateBlueprint({ store, provider: ai }, blueprintInput)).rejects.toMatchObject({ code: 'ai_malformed_output' })
    expect(calls.finish).toEqual([{ succeeded: false, content: undefined }])
  })

  it('maps provider rate limits and outages, releasing the reservation', async () => {
    for (const [failure, code] of [['rate_limited', 'ai_rate_limited'], ['unavailable', 'ai_unavailable']] as const) {
      const { store, calls } = memoryStore()
      await expect(generateBlueprint({ store, provider: provider(new IntelligenceError(failure, 'x')) }, blueprintInput)).rejects.toMatchObject({ code })
      expect(calls.finish.map((call) => call.succeeded)).toEqual([false])
    }
  })

  it('reports an expired claim instead of claiming success', async () => {
    const { store } = memoryStore({ settlement: null })
    await expect(generateBlueprint({ store, provider: provider(VALID_BLUEPRINT) }, blueprintInput)).rejects.toMatchObject({ code: 'generation_expired' })
  })
})

describe('generateAsset', () => {
  const knowledge = assembleKnowledge({ id: 'project-1', title: 'Crumb & Co', content: { business_summary: 'Pricing coaching' } }, interview.answers)
  const assetInput = { userId: 'user-1', projectId: 'project-1', type: getAssetType('faq')!, knowledge, skipEntitlement: false }

  it('saves validated output and consumes the build once', async () => {
    const { store, calls } = memoryStore()
    await expect(generateAsset({ store, provider: provider(VALID_ASSET) }, assetInput)).resolves.toEqual({ assetId: 'asset-1' })
    expect(calls.begin).toBe(1)
    expect(calls.finish).toEqual([{ succeeded: true, error: undefined, title: 'Profit-First Pricing FAQ', content: expect.stringContaining('# FAQ') }])
  })

  it('refuses when the build limit is reached', async () => {
    const { store } = memoryStore({ denial: { reason: 'build_limit', plan: 'creator', buildLimit: 5 } })
    await expect(generateAsset({ store, provider: provider(VALID_ASSET) }, assetInput)).rejects.toMatchObject({ code: 'limit_reached', message: "You've used all 5 build credits on your Creator plan for this period." })
  })

  it('refuses a second concurrent generation', async () => {
    const { store } = memoryStore({ denial: { reason: 'generation_in_progress' } })
    await expect(generateAsset({ store, provider: provider(VALID_ASSET) }, assetInput)).rejects.toMatchObject({ code: 'generation_in_progress' })
  })

  it('records malformed output as a failed asset, releasing the build', async () => {
    const { store, calls } = memoryStore()
    await expect(generateAsset({ store, provider: provider(JSON.stringify({ title: 'x', content_markdown: 'too short' })) }, assetInput)).rejects.toMatchObject({ code: 'ai_malformed_output' })
    expect(calls.finish).toEqual([{ succeeded: false, error: 'The AI returned an incomplete response. Please try again.', title: undefined, content: undefined }])
  })

  it('still throws the original error if recording the failure also fails', async () => {
    const { store } = memoryStore()
    store.finishAsset = async () => { throw new HkeError('database_error', 'down') }
    await expect(generateAsset({ store, provider: provider('nope') }, assetInput)).rejects.toMatchObject({ code: 'ai_malformed_output' })
  })
})
