import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HkeError } from './errors'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Returns a session-bound Supabase client (RLS applies) and the signed-in user,
 * or a 401 response. Ownership is always taken from this user, never from the
 * request body.
 */
export async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Please sign in again.', code: 'unauthenticated' }, { status: 401 }) } as const
  return { supabase, user } as const
}

/**
 * Like requireUser, but also accepts `Authorization: Bearer <access token>`
 * (the builder sends one after refreshing the session). Either way the client
 * acts as the user, so RLS applies. Throws HkeError('unauthenticated').
 */
export async function authenticate(request: Request): Promise<{ supabase: SupabaseClient; user: User }> {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new HkeError('unauthenticated', 'Your session expired. Please sign in again. Your answers are saved.')
    return { supabase, user: data.user }
  }
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new HkeError('unauthenticated', 'Please sign in again.')
  return { supabase, user }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}
