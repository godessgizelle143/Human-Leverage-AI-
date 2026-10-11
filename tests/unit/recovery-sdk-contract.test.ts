import { createServerClient } from '@supabase/ssr'
import { describe, expect, it } from 'vitest'
import { completeAuthCallback } from '@/lib/auth/callback'

/**
 * The reset journey rests on one behaviour of the installed Supabase client:
 * when a reset is requested, the stored PKCE verifier is marked as a recovery,
 * and a later code exchange that reads it from the cookies (as the callback
 * route does on the server) reports `redirectType: 'recovery'`.
 *
 * This runs the real @supabase/ssr and auth clients against an in-memory
 * cookie jar and an in-memory fetch. Nothing reaches a network. If a Supabase
 * upgrade changes the behaviour, this fails instead of the reset form
 * silently never opening.
 */
const SUPABASE_URL = 'https://project-ref.supabase.test'
const USER = { id: '00000000-0000-4000-8000-0000000000a1', aud: 'authenticated', role: 'authenticated', email: 'founder@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' }

type Sent = { url: string; method: string; body: Record<string, unknown> }

function harness() {
  const jar = new Map<string, string>()
  const sent: Sent[] = []

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    sent.push({ url, method: init?.method ?? 'GET', body })
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/auth/v1/recover')) return json({})
    if (url.includes('/auth/v1/token')) {
      return json({ access_token: 'header.payload.signature', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-token', user: USER })
    }
    if (url.includes('/auth/v1/authorize')) return json({})
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  /** A client reading and writing the same cookies, as the browser and then the server would. */
  const client = () =>
    createServerClient(SUPABASE_URL, 'anon-key-not-real', {
      global: { fetch: fetchStub },
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => (options?.maxAge === 0 || value === '' ? jar.delete(name) : jar.set(name, value))),
      },
    })

  return { jar, sent, client }
}

describe('Supabase client behaviour the reset journey depends on', () => {
  it('marks a reset request so that a later server-side exchange reports a recovery', async () => {
    const { jar, sent, client } = harness()

    const requested = await client().auth.resetPasswordForEmail('founder@example.test', { redirectTo: 'https://hke.test/api/auth/callback' })
    expect(requested.error).toBeNull()

    // The reset request used PKCE and asked to return to the callback.
    const recover = sent.find((request) => request.url.includes('/auth/v1/recover'))!
    expect(recover.body.code_challenge).toEqual(expect.any(String))
    expect(recover.url).toContain(`redirect_to=${encodeURIComponent('https://hke.test/api/auth/callback')}`)
    // The verifier is kept in a cookie, so the server can read it later.
    expect(Array.from(jar.keys()).some((name) => name.includes('code-verifier'))).toBe(true)

    // Later, a separate client (the callback route) exchanges the code.
    const { data, error } = await client().auth.exchangeCodeForSession('code-from-email')
    expect(error).toBeNull()
    expect((data as { redirectType?: string | null }).redirectType).toBe('recovery')
    expect(data.session?.user.id).toBe(USER.id)

    // The verifier sent to Supabase is the bare verifier, without the marker.
    const token = sent.find((request) => request.url.includes('/auth/v1/token'))!
    expect(token.body.auth_code).toBe('code-from-email')
    expect(String(token.body.code_verifier)).not.toContain('/')
  })

  it('does not report a recovery for a sign-in that was not a reset request', async () => {
    const { client } = harness()
    const started = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hke.test/api/auth/callback', skipBrowserRedirect: true } })
    expect(started.error).toBeNull()

    const { data, error } = await client().auth.exchangeCodeForSession('code-from-google')
    expect(error).toBeNull()
    expect((data as { redirectType?: string | null }).redirectType ?? null).toBeNull()
  })

  it('drives the real callback logic to a recovery outcome with the real client', async () => {
    const { client } = harness()
    await client().auth.resetPasswordForEmail('founder@example.test', { redirectTo: 'https://hke.test/api/auth/callback' })

    const server = client()
    const outcome = await completeAuthCallback(
      { auth: { exchangeCodeForSession: (code) => server.auth.exchangeCodeForSession(code), verifyOtp: (params) => server.auth.verifyOtp(params), getUser: async () => ({ data: { user: USER }, error: null }) as never }, rpc: (() => { throw new Error('start_trial must not run for a recovery') }) as never },
      new URLSearchParams('code=code-from-email'),
    )
    expect(outcome).toEqual({ ok: true, recovery: { userId: USER.id } })
  })

  it('fails the exchange when the reset link is opened where no verifier is stored', async () => {
    const { client } = harness()
    const { data, error } = await client().auth.exchangeCodeForSession('code-from-email')
    expect(error).not.toBeNull()
    expect(data.session).toBeNull()
  })
})
