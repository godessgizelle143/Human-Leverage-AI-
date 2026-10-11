import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APIConnectionTimeoutError, APIError } from 'openai'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({}), createServiceRoleClient: () => ({}) }))

import { maxDuration as assetRouteLimit } from '@/app/api/projects/[id]/assets/route'
import { maxDuration as blueprintRouteLimit } from '@/app/api/projects/generate/route'
import { HkeError } from '@/lib/hke/errors'
import { IntelligenceError, openAIProvider } from '@/lib/hke/intelligence/provider'
import { generateStructured } from '@/lib/hke/intelligence/structured'
import { BlueprintOutputSchema } from '@/lib/hke/intelligence/schemas'
import { getOpenAIClient } from '@/lib/openai/client'

/** No request leaves this file: the SDK's create method is always replaced. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const request = { system: 'system', user: 'user' }

beforeAll(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real')
})

afterEach(() => {
  vi.restoreAllMocks()
})

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('OpenAI request policy', () => {
  it('has exactly one place that creates the client and one that sends a request', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('lib')]
    const containing = (pattern: RegExp) => files.filter((file) => pattern.test(readFileSync(join(ROOT, file), 'utf8'))).sort()
    expect(containing(/new OpenAI\(/)).toEqual(['lib/openai/client.ts'])
    expect(containing(/chat\.completions|\.responses\.create|\.embeddings\.create/)).toEqual(['lib/hke/intelligence/provider.ts'])
  })

  it('gives every generation route at least 10 seconds after the longest possible provider wait', () => {
    const client = getOpenAIClient()
    // The installed SDK waits for a Retry-After of up to 60 seconds before each retry.
    const longestBackoffMs = client.maxRetries * 60_000
    const longestProviderWaitMs = client.timeout * (client.maxRetries + 1) + longestBackoffMs

    expect(blueprintRouteLimit).toBe(60)
    expect(assetRouteLimit).toBe(60)
    for (const limit of [blueprintRouteLimit, assetRouteLimit]) {
      expect(limit * 1000 - longestProviderWaitMs).toBeGreaterThanOrEqual(10_000)
    }
  })

  it('uses an explicit 45-second timeout and no SDK retries', () => {
    const client = getOpenAIClient()
    expect(client.timeout).toBe(45_000)
    expect(client.maxRetries).toBe(0)
  })
})

describe('provider timeouts', () => {
  it('reports an SDK timeout as a timeout, not as a generic outage', async () => {
    vi.spyOn(getOpenAIClient().chat.completions, 'create').mockRejectedValue(new APIConnectionTimeoutError())
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const failure = await openAIProvider.completeJson(request).catch((error) => error)
    expect(failure).toBeInstanceOf(IntelligenceError)
    expect((failure as IntelligenceError).failure).toBe('timeout')
  })

  it('gives the customer an honest, actionable timeout error', async () => {
    vi.spyOn(getOpenAIClient().chat.completions, 'create').mockRejectedValue(new APIConnectionTimeoutError())
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const failure = await generateStructured(openAIProvider, BlueprintOutputSchema, request).catch((error) => error)
    expect(failure).toBeInstanceOf(HkeError)
    expect((failure as HkeError).code).toBe('ai_timeout')
    expect((failure as HkeError).status).toBe(504)
    expect((failure as HkeError).message).toMatch(/took too long/i)
    expect((failure as HkeError).message).toMatch(/try again/i)
  })

  it('still reports rate limits and other provider failures as before', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const create = vi.spyOn(getOpenAIClient().chat.completions, 'create')

    create.mockRejectedValueOnce(APIError.generate(429, { error: { message: 'rate limited' } }, 'rate limited', {}))
    expect(((await openAIProvider.completeJson(request).catch((error) => error)) as IntelligenceError).failure).toBe('rate_limited')

    create.mockRejectedValueOnce(APIError.generate(500, { error: { message: 'server error' } }, 'server error', {}))
    expect(((await openAIProvider.completeJson(request).catch((error) => error)) as IntelligenceError).failure).toBe('unavailable')
  })

  it('does not override the client timeout or retries on the request itself', async () => {
    const create = vi.spyOn(getOpenAIClient().chat.completions, 'create').mockResolvedValue({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }], model: 'test-model' } as never)
    await openAIProvider.completeJson(request)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]).toHaveLength(1) // no per-request options that could raise the limits
  })
})
