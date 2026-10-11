import { NextRequest } from 'next/server'
import { isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The password-reset journey after the email link is opened, through the real
 * callback route, reset page, save-password route, and middleware. Supabase
 * and Next's request plumbing are replaced; nothing is sent and no real
 * account is touched.
 */
const USER = '00000000-0000-4000-8000-0000000000a1'
const OTHER_USER = '00000000-0000-4000-8000-0000000000a2'

type AuthError = { message: string; code?: string; name?: string; __isAuthError?: boolean }

const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  user: null as { id: string } | null,
  exchange: { error: null, data: { redirectType: null } } as { error: { message: string } | null; data?: { redirectType: string | null } },
  verify: { error: null } as { error: { message: string } | null },
  update: { error: null } as { error: { message: string; code?: string; name?: string; __isAuthError?: boolean } | null },
  calls: { exchange: [] as string[], verify: [] as unknown[], update: [] as unknown[], signOut: [] as unknown[], trial: 0 },
}))

class Redirect extends Error {
  constructor(readonly destination: string) { super(`redirect:${destination}`) }
}

vi.mock('next/navigation', () => ({ redirect: (destination: string) => { throw new Redirect(destination) } }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.jar.has(name) ? { name, value: mocks.jar.get(name)! } : undefined),
    getAll: () => Array.from(mocks.jar, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => { mocks.jar.set(name, value) },
    delete: (name: string) => { mocks.jar.delete(name) },
  }),
}))

function fakeSupabase(setAll?: (cookies: { name: string; value: string }[]) => void) {
  return {
    auth: {
      async exchangeCodeForSession(code: string) {
        mocks.calls.exchange.push(code)
        if (!mocks.exchange.error) setAll?.([{ name: 'sb-session', value: 'session-for-' + code }])
        return mocks.exchange
      },
      async verifyOtp(params: unknown) {
        mocks.calls.verify.push(params)
        if (!mocks.verify.error) setAll?.([{ name: 'sb-session', value: 'session-from-token' }])
        return mocks.verify
      },
      getUser: async () => ({ data: { user: mocks.user } }),
      async updateUser(attributes: unknown) { mocks.calls.update.push(attributes); return mocks.update },
      async signOut(options: unknown) { mocks.calls.signOut.push(options); mocks.jar.delete('sb-session'); return { error: null } },
    },
    rpc: async () => { mocks.calls.trial += 1; return { error: null } },
  }
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: { name: string; value: string }[]) => void } }) => fakeSupabase(options.cookies.setAll),
}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakeSupabase() }))

import ResetPasswordPage from '@/app/(auth)/reset-password/page'
import { GET as callback } from '@/app/api/auth/callback/route'
import { POST as savePassword } from '@/app/api/auth/reset-password/route'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { MIN_PASSWORD_LENGTH, newPasswordProblem, RECOVERY_COOKIE, RECOVERY_MAX_AGE_SECONDS } from '@/lib/auth/recovery'
import { middleware } from '@/middleware'

const ORIGIN = 'https://hke.test'
const openLink = (query: string) => callback(new Request(`${ORIGIN}/api/auth/callback?${query}`))
const location = (response: Response) => (response.headers.get('location') ?? '').replace(ORIGIN, '')
const setCookies = (response: Response) => response.headers.getSetCookie()
const cookie = (response: Response, name: string) => setCookies(response).find((value) => value.startsWith(`${name}=`))

function post(body: unknown) {
  return savePassword(new Request(`${ORIGIN}/api/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

function elements(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  return [{ type: node.type, props }, ...elements(props.children as ReactNode)]
}

/** What the reset page does: redirect somewhere, or show the form in a state. */
async function openResetPage(searchParams: Record<string, string> = {}) {
  try {
    const form = elements(await ResetPasswordPage({ searchParams })).find((element) => element.type === ResetPasswordForm)
    return { redirectedTo: null, form: form?.props.initialStatus }
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.destination, form: undefined }
    throw error
  }
}

const sessionMissing: AuthError = { message: 'Auth session missing!', name: 'AuthSessionMissingError', __isAuthError: true }

beforeEach(() => {
  mocks.jar = new Map()
  mocks.user = { id: USER }
  mocks.exchange = { error: null, data: { redirectType: null } }
  mocks.verify = { error: null }
  mocks.update = { error: null }
  mocks.calls = { exchange: [], verify: [], update: [], signOut: [], trial: 0 }
  vi.restoreAllMocks()
})

describe('opening a password-reset link', () => {
  it('signs the customer in for recovery and sends them to the reset form', async () => {
    mocks.exchange = { error: null, data: { redirectType: 'recovery' } }
    const response = await openLink('code=reset-code')

    expect(response.status).toBe(307)
    expect(location(response)).toBe('/reset-password')
    expect(mocks.calls.exchange).toEqual(['reset-code'])
    expect(cookie(response, 'sb-session')).toContain('session-for-reset-code')
    const marker = cookie(response, RECOVERY_COOKIE)!
    expect(marker).toContain(`${RECOVERY_COOKIE}=${USER}`)
    expect(marker).toMatch(/HttpOnly/i)
    expect(marker).toMatch(/Secure/i)
    expect(marker).toMatch(/SameSite=lax/i)
    expect(marker).toContain(`Max-Age=${RECOVERY_MAX_AGE_SECONDS}`)
    expect(mocks.calls.trial).toBe(0)
  })

  it('completes a token-hash reset link, which works in any browser', async () => {
    const response = await openLink('token_hash=th&type=recovery')
    expect(location(response)).toBe('/reset-password')
    expect(mocks.calls.verify).toEqual([{ token_hash: 'th', type: 'recovery' }])
    expect(cookie(response, RECOVERY_COOKIE)).toContain(USER)
  })

  it('sends a failed reset link back to the reset page with no session and no marker', async () => {
    mocks.verify = { error: { message: 'Email link is invalid or has expired' } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await openLink('token_hash=th&type=recovery')
    expect(location(response)).toBe('/reset-password?error=link-invalid')
    expect(setCookies(response)).toEqual([])
  })

  it('sends an expired link reported by Supabase to sign-in with the invalid-link message', async () => {
    const response = await openLink('error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(location(response)).toBe('/login?error=link-invalid')
    expect(setCookies(response)).toEqual([])
  })

  it('still sends an ordinary sign-in or confirmation link to the dashboard, and clears any reset marker', async () => {
    const response = await openLink('code=signin-code')
    expect(location(response)).toBe('/dashboard')
    expect(cookie(response, 'sb-session')).toContain('session-for-signin-code')
    expect(cookie(response, RECOVERY_COOKIE)).toMatch(new RegExp(`^${RECOVERY_COOKIE}=;`)) // expired, never set to a user
    expect(mocks.calls.trial).toBe(1)
  })

  it('still reports a cancelled Google sign-in as before', async () => {
    expect(location(await openLink('error=access_denied'))).toBe('/login?error=oauth-cancelled')
  })
})

describe('the reset-password page', () => {
  it('opens the form after a reset link was completed for the signed-in account', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    expect(await openResetPage()).toEqual({ redirectedTo: null, form: 'ready' })
  })

  it('stays open across a refresh, because nothing depends on the address bar', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    expect((await openResetPage()).form).toBe('ready')
    expect((await openResetPage()).form).toBe('ready')
  })

  it('does not open for an ordinary signed-in session', async () => {
    expect(await openResetPage()).toEqual({ redirectedTo: null, form: 'invalid' })
  })

  it('does not open when the marker belongs to a different account', async () => {
    mocks.jar.set(RECOVERY_COOKIE, OTHER_USER)
    expect((await openResetPage()).form).toBe('invalid')
  })

  it('does not open without a session, even with a marker', async () => {
    mocks.user = null
    mocks.jar.set(RECOVERY_COOKIE, USER)
    expect((await openResetPage()).form).toBe('invalid')
  })

  it('shows the request-a-new-link state for a failed link', async () => {
    mocks.user = null
    expect(await openResetPage({ error: 'link-invalid' })).toEqual({ redirectedTo: null, form: 'invalid' })
  })

  it('hands a link that arrives here directly to the callback to complete', async () => {
    expect(await openResetPage({ code: 'old-format-code' })).toMatchObject({ redirectedTo: '/api/auth/callback?code=old-format-code' })
    expect(await openResetPage({ token_hash: 'th', type: 'recovery' })).toMatchObject({ redirectedTo: '/api/auth/callback?token_hash=th&type=recovery' })
    expect(await openResetPage({ token_hash: 'th' })).toMatchObject({ redirectedTo: '/api/auth/callback?token_hash=th&type=recovery' })
  })
})

describe('saving the new password', () => {
  const good = { password: 'a-new-passphrase', confirmPassword: 'a-new-passphrase' }

  it('updates the password, signs the recovery session out, and removes the marker', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    mocks.jar.set('sb-session', 'recovery-session')
    const response = await post(good)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.calls.update).toEqual([{ password: 'a-new-passphrase' }])
    expect(mocks.calls.signOut).toEqual([{ scope: 'local' }])
    expect(mocks.jar.has(RECOVERY_COOKIE)).toBe(false)
    expect(mocks.jar.has('sb-session')).toBe(false)
    // The form cannot be reopened afterwards.
    mocks.user = null
    expect((await openResetPage()).form).toBe('invalid')
  })

  it.each([
    ['an ordinary signed-in session', () => {}],
    ['a marker for a different account', () => { mocks.jar.set(RECOVERY_COOKIE, OTHER_USER) }],
    ['no session', () => { mocks.user = null; mocks.jar.set(RECOVERY_COOKIE, USER) }],
  ] as const)('refuses to change the password with %s', async (_case, arrange) => {
    arrange()
    const response = await post(good)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'recovery-expired' })
    expect(mocks.calls.update).toEqual([])
  })

  it.each([
    ['too short', { password: 'short', confirmPassword: 'short' }, /at least 8 characters/],
    ['not matching', { password: 'a-new-passphrase', confirmPassword: 'a-different-one' }, /do not match/],
    ['missing', {}, /at least 8 characters/],
  ] as const)('rejects a new password that is %s without calling Supabase', async (_case, body, message) => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    const response = await post(body)
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(message)
    expect(mocks.calls.update).toEqual([])
    expect(mocks.jar.get(RECOVERY_COOKIE)).toBe(USER) // the customer can correct it and try again
  })

  it('tells the customer when the new password is the same as the old one, and lets them retry', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    mocks.update = { error: { message: 'New password should be different from the old password.', code: 'same_password' } }
    const response = await post(good)
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/different from your current one/)
    expect(mocks.jar.get(RECOVERY_COOKIE)).toBe(USER)
    expect(mocks.calls.signOut).toEqual([])
  })

  it('passes on the rules a weak password did not meet', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    mocks.update = { error: { message: 'Password should contain at least one number.', code: 'weak_password' } }
    expect((await (await post(good)).json()).error).toBe('Password should contain at least one number.')
  })

  it('asks for a new link when the recovery session has expired', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    mocks.update = { error: sessionMissing }
    const response = await post(good)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'recovery-expired' })
    expect(mocks.jar.has(RECOVERY_COOKIE)).toBe(false)
  })

  it('reports an unexpected failure without exposing the provider message', async () => {
    mocks.jar.set(RECOVERY_COOKIE, USER)
    mocks.update = { error: { message: 'internal: connection reset by peer' } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await post(good)
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('Unable to update your password. Please try again.')
    expect(mocks.jar.get(RECOVERY_COOKIE)).toBe(USER)
  })

  it('shares one set of password rules between the form and the route', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(newPasswordProblem('12345678', '12345678')).toBeNull()
    expect(newPasswordProblem('1234567', '1234567')).toMatch(/at least 8/)
    expect(newPasswordProblem('x'.repeat(73), 'x'.repeat(73))).toMatch(/at most 72/)
    expect(newPasswordProblem('12345678', '12345679')).toMatch(/do not match/)
  })
})

describe('the whole journey after the email is opened', () => {
  it('link -> reset form -> new password -> sign-in prompt', async () => {
    mocks.exchange = { error: null, data: { redirectType: 'recovery' } }

    // 1. The customer opens the link in the email.
    const opened = await openLink('code=reset-code')
    expect(location(opened)).toBe('/reset-password')
    // The browser stores what the response set.
    for (const header of setCookies(opened)) {
      const [pair] = header.split(';')
      mocks.jar.set(pair.slice(0, pair.indexOf('=')), decodeURIComponent(pair.slice(pair.indexOf('=') + 1)))
    }

    // 2. The reset page opens the form.
    expect(await openResetPage()).toEqual({ redirectedTo: null, form: 'ready' })

    // 3. The customer saves a new password.
    const saved = await post({ password: 'a-new-passphrase', confirmPassword: 'a-new-passphrase' })
    expect(await saved.json()).toEqual({ ok: true })
    expect(mocks.calls.update).toEqual([{ password: 'a-new-passphrase' }])

    // 4. The recovery session is over; the customer signs in with the new password.
    expect(mocks.jar.has('sb-session')).toBe(false)
    expect(mocks.jar.has(RECOVERY_COOKIE)).toBe(false)
  })
})

describe('middleware', () => {
  const visit = (path: string) => middleware(new NextRequest(`${ORIGIN}${path}`))

  it('passes an email link that landed on the home page to the callback, keeping its code', async () => {
    const response = await visit('/?code=reset-code')
    expect(response.status).toBe(307)
    expect(location(response)).toBe('/api/auth/callback?code=reset-code')

    const token = await visit('/?token_hash=th&type=recovery')
    expect(location(token)).toBe('/api/auth/callback?token_hash=th&type=recovery')
  })

  it('leaves the home page alone otherwise', async () => {
    const response = await visit('/')
    expect(response.headers.get('location')).toBeNull()
  })

  it('still keeps signed-in users out of sign-in and signed-out users out of the dashboard', async () => {
    expect(location(await visit('/login'))).toBe('/dashboard')
    mocks.user = null
    expect(location(await visit('/dashboard'))).toBe('/login')
    expect((await visit('/login')).headers.get('location')).toBeNull()
  })
})
