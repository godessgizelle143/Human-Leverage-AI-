import { describe, expect, it, vi } from 'vitest'
import { completeAuthCallback } from '@/lib/auth/callback'
import { AUTH_ERROR_MESSAGES, authErrorMessage, dashboardNotice } from '@/lib/auth/messages'

type Result = { error: { message: string } | null; data?: { redirectType?: string | null } }

function client(options: { exchange?: Result; verify?: Result; user?: { id: string } | null; trial?: Result } = {}) {
  return {
    auth: {
      exchangeCodeForSession: vi.fn(async () => options.exchange ?? { error: null }),
      verifyOtp: vi.fn(async () => options.verify ?? { error: null }),
      getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: 'user-1' } : options.user } })),
    },
    rpc: vi.fn(async () => options.trial ?? { error: null }),
  }
}

// The fake implements only what the callback calls.
const run = (supabase: ReturnType<typeof client>, query: string) =>
  completeAuthCallback(supabase as unknown as Parameters<typeof completeAuthCallback>[0], new URLSearchParams(query))

describe('completeAuthCallback', () => {
  it('exchanges a PKCE code and starts the trial from the session', async () => {
    const supabase = client()
    await expect(run(supabase, 'code=abc')).resolves.toEqual({ ok: true })
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(supabase.rpc).toHaveBeenCalledWith('start_trial')
  })

  it('keeps the user signed in when trial creation fails (dashboard retries it)', async () => {
    const supabase = client({ trial: { error: { message: 'boom' } } })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    await expect(run(supabase, 'code=abc')).resolves.toEqual({ ok: true })
  })

  it('verifies token-hash email links so confirmation works in any browser', async () => {
    const supabase = client()
    await expect(run(supabase, 'token_hash=th&type=signup')).resolves.toEqual({ ok: true })
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'th', type: 'signup' })
  })

  // Password-reset links used to be refused here and left to the reset page's
  // own browser-side handling, which is what broke the reset journey. They are
  // now completed here and reported as a recovery.
  it('completes a token-hash password-reset link as a recovery, without starting a trial', async () => {
    const supabase = client()
    await expect(run(supabase, 'token_hash=th&type=recovery')).resolves.toEqual({ ok: true, recovery: { userId: 'user-1' } })
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'th', type: 'recovery' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('recognises a PKCE password-reset link from the stored verifier, not from the URL', async () => {
    const supabase = client({ exchange: { error: null, data: { redirectType: 'recovery' } } })
    await expect(run(supabase, 'code=abc')).resolves.toEqual({ ok: true, recovery: { userId: 'user-1' } })
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('does not treat an ordinary sign-in link as a recovery, whatever the URL claims', async () => {
    const supabase = client({ exchange: { error: null, data: { redirectType: null } } })
    await expect(run(supabase, 'code=abc&type=recovery&recovery=1')).resolves.toEqual({ ok: true })
    expect(supabase.rpc).toHaveBeenCalledWith('start_trial')
  })

  it('reports a failed password-reset link as a failed recovery', async () => {
    const supabase = client({ verify: { error: { message: 'Email link is invalid or has expired' } } })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    await expect(run(supabase, 'token_hash=th&type=recovery')).resolves.toEqual({ ok: false, error: 'link-invalid', recovery: true })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('reports an expired email link as an invalid link, not as a Google sign-in problem', async () => {
    const supabase = client()
    await expect(run(supabase, 'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).resolves.toEqual({ ok: false, error: 'link-invalid' })
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('maps a cancelled Google consent to a fixed code', async () => {
    const supabase = client()
    await expect(run(supabase, 'error=access_denied&error_description=<script>')).resolves.toEqual({ ok: false, error: 'oauth-cancelled' })
    await expect(run(supabase, 'error=server_error')).resolves.toEqual({ ok: false, error: 'oauth-failed' })
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('reports a failed exchange without starting a trial', async () => {
    const supabase = client({ exchange: { error: { message: 'code verifier missing' } } })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    await expect(run(supabase, 'code=abc')).resolves.toEqual({ ok: false, error: 'link-invalid' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('fails when no user is attached after the exchange', async () => {
    const supabase = client({ user: null })
    await expect(run(supabase, 'code=abc')).resolves.toEqual({ ok: false, error: 'session-failed' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('requires a code or token hash', async () => {
    await expect(run(client(), '')).resolves.toEqual({ ok: false, error: 'missing-code' })
  })
})

describe('auth messages', () => {
  it('shows only fixed text for callback error codes', () => {
    expect(authErrorMessage('oauth-cancelled')).toBe(AUTH_ERROR_MESSAGES['oauth-cancelled'])
    expect(authErrorMessage('<img src=x onerror=alert(1)>')).not.toContain('<img')
    expect(authErrorMessage(null)).toBeNull()
  })

  it('maps checkout results to dashboard notices', () => {
    expect(dashboardNotice({ checkout: 'success' })?.tone).toBe('success')
    expect(dashboardNotice({ error: 'payment-required' })?.tone).toBe('error')
    expect(dashboardNotice({ error: 'payment-required', checkout: 'success' })?.tone).toBe('error')
    expect(dashboardNotice({ error: 'anything-else' })).toBeNull()
    expect(dashboardNotice({ checkout: ['success', 'x'] })).toBeNull()
  })
})
