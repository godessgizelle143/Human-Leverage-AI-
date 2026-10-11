import type { z } from 'zod'
import { HkeError } from '../errors'
import { IntelligenceError, type IntelligenceProvider, type JsonCompletionRequest } from './provider'

export type StructuredResult<T> = { data: T; model: string }

/**
 * Asks the provider for JSON and accepts it only if it parses and matches the
 * schema. Model output is never trusted as structured data before this.
 */
export async function generateStructured<Schema extends z.ZodType>(
  provider: IntelligenceProvider,
  schema: Schema,
  request: JsonCompletionRequest,
): Promise<StructuredResult<z.output<Schema>>> {
  let completion
  try {
    completion = await provider.completeJson(request)
  } catch (error) {
    if (error instanceof IntelligenceError && error.failure === 'rate_limited') {
      throw new HkeError('ai_rate_limited', 'The AI service has reached its usage limit. Please try again later.')
    }
    if (error instanceof IntelligenceError && error.failure === 'timeout') {
      throw new HkeError('ai_timeout', 'The AI took too long to respond, so this attempt was stopped. Please try again.')
    }
    throw new HkeError('ai_unavailable', 'The AI service is temporarily unavailable. Please try again.')
  }

  if (completion.truncated) throw new HkeError('ai_malformed_output', 'The AI response was too long to finish. Please try again.')

  let parsed: unknown
  try {
    parsed = JSON.parse(completion.text)
  } catch {
    throw new HkeError('ai_malformed_output', 'The AI returned an unreadable response. Please try again.')
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error('AI output failed validation:', result.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`).join('; '))
    throw new HkeError('ai_malformed_output', 'The AI returned an incomplete response. Please try again.')
  }
  return { data: result.data, model: completion.model }
}
