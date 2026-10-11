import { APIConnectionTimeoutError } from 'openai'
import { getOpenAIClient } from '@/lib/openai/client'

/**
 * The seam between HKE and any model provider. Retrieval (RAG), embeddings,
 * and agents plug in behind this or alongside it; callers only depend on the
 * request/response shapes here.
 */
export type JsonCompletionRequest = {
  system: string
  user: string
  temperature?: number
  maxOutputTokens?: number
}

export type JsonCompletion = {
  text: string
  /** The provider stopped because of the output limit; the JSON is likely cut off. */
  truncated: boolean
  model: string
}

export type IntelligenceFailure = 'rate_limited' | 'timeout' | 'unavailable'

export class IntelligenceError extends Error {
  readonly failure: IntelligenceFailure
  constructor(failure: IntelligenceFailure, message: string) {
    super(message)
    this.name = 'IntelligenceError'
    this.failure = failure
  }
}

export interface IntelligenceProvider {
  isConfigured(): boolean
  completeJson(request: JsonCompletionRequest): Promise<JsonCompletion>
}

export const openAIProvider: IntelligenceProvider = {
  isConfigured: () => !!process.env.OPENAI_API_KEY,

  async completeJson(request) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      })
      const choice = completion.choices[0]
      return { text: choice?.message?.content ?? '', truncated: choice?.finish_reason === 'length', model: completion.model || model }
    } catch (error) {
      // The client's own time limit (lib/openai/client.ts) was reached.
      if (error instanceof APIConnectionTimeoutError) {
        console.error('AI provider request failed:', 'timeout')
        throw new IntelligenceError('timeout', 'The AI service took too long to respond.')
      }
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : 0
      // Only the status is logged; provider messages can echo request content.
      console.error('AI provider request failed:', status || 'network')
      if (status === 429) throw new IntelligenceError('rate_limited', 'The AI service is at its usage limit.')
      throw new IntelligenceError('unavailable', 'The AI service did not respond.')
    }
  },
}
