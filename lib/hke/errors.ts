import { NextResponse } from 'next/server'

/**
 * Every failure an HKE route can report. The message on an HkeError is always
 * safe to show to the user; anything else is logged and replaced with a
 * generic message.
 */
export type HkeErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'invalid_input'
  | 'no_subscription'
  | 'limit_reached'
  | 'archived'
  | 'conflict'
  | 'generation_in_progress'
  | 'generation_expired'
  | 'not_configured'
  | 'ai_unavailable'
  | 'ai_rate_limited'
  | 'ai_timeout'
  | 'ai_malformed_output'
  | 'database_error'
  | 'internal'

const STATUS: Record<HkeErrorCode, number> = {
  unauthenticated: 401,
  not_found: 404,
  invalid_input: 400,
  no_subscription: 403,
  limit_reached: 403,
  archived: 409,
  conflict: 409,
  generation_in_progress: 409,
  generation_expired: 409,
  not_configured: 503,
  ai_unavailable: 502,
  ai_rate_limited: 429,
  ai_timeout: 504,
  ai_malformed_output: 502,
  database_error: 500,
  internal: 500,
}

export class HkeError extends Error {
  readonly code: HkeErrorCode
  /** Extra JSON fields for the client, e.g. { projectId } on a conflict. */
  readonly details?: Record<string, string | number | null>

  constructor(code: HkeErrorCode, message: string, details?: Record<string, string | number | null>) {
    super(message)
    this.name = 'HkeError'
    this.code = code
    this.details = details
  }

  get status() {
    return STATUS[this.code]
  }
}

export function isHkeError(error: unknown): error is HkeError {
  return error instanceof HkeError
}

/** Converts any thrown value into a JSON response without leaking internals. */
export function errorResponse(error: unknown, context: string) {
  if (isHkeError(error)) {
    if (error.status >= 500) console.error(`${context}: ${error.code}`)
    return NextResponse.json({ error: error.message, code: error.code, ...error.details }, { status: error.status })
  }
  console.error(`${context}:`, error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'internal' }, { status: 500 })
}

export const notFound = (what = 'Project') => new HkeError('not_found', `${what} not found.`)
