import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'
import type { AuthErrorCode } from './messages'

/** Email link types the callback verifies from a token hash. */
const CALLBACK_OTP_TYPES = new Set<EmailOtpType>(['signup', 'email', 'invite', 'magiclink', 'email_change', 'recovery'])

type CallbackAuth = Pick<SupabaseClient['auth'], 'exchangeCodeForSession' | 'verifyOtp' | 'getUser'>
type CallbackClient = { auth: CallbackAuth; rpc: SupabaseClient['rpc'] }

export type CallbackOutcome =
  /** `recovery` is set when the link was a password-reset link: the customer goes to the reset form, not the dashboard. */
  | { ok: true; recovery?: { userId: string } }
  /** `recovery` is set when a link known to be a password-reset link failed. */
  | { ok: false; error: AuthErrorCode; recovery?: true }

/**
 * Completes an OAuth, PKCE email, or token-hash email link and makes sure the
 * user has a subscription row. Ownership of the trial always comes from the
 * session (start_trial reads auth.uid()), never from the URL.
 *
 * Password-reset links are completed here too. A PKCE reset link is
 * recognised from the verifier the browser stored when the reset was
 * requested (Supabase marks it as a recovery flow), never from a URL
 * parameter, so a link cannot ask to be treated as a recovery.
 *
 * A failed trial creation does not fail sign-in: the user is authenticated,
 * start_trial is idempotent, and the dashboard retries it on every load.
 */
export async function completeAuthCallback(supabase: CallbackClient, params: URLSearchParams): Promise<CallbackOutcome> {
  const providerError = params.get('error')
  if (providerError) {
    // Supabase reports an expired or already-used email link this way too.
    if (params.get('error_code') === 'otp_expired') return { ok: false, error: 'link-invalid' }
    return { ok: false, error: providerError === 'access_denied' ? 'oauth-cancelled' : 'oauth-failed' }
  }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  let recovery = false

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('AUTH CALLBACK CODE EXCHANGE ERROR:', error.message)
      return { ok: false, error: 'link-invalid' }
    }
    recovery = (data as { redirectType?: string | null } | null | undefined)?.redirectType === 'recovery'
  } else if (tokenHash && type && CALLBACK_OTP_TYPES.has(type)) {
    recovery = type === 'recovery'
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.error('AUTH CALLBACK OTP ERROR:', error.message)
      return recovery ? { ok: false, error: 'link-invalid', recovery: true } : { ok: false, error: 'link-invalid' }
    }
  } else {
    return { ok: false, error: 'missing-code' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return recovery ? { ok: false, error: 'session-failed', recovery: true } : { ok: false, error: 'session-failed' }

  // A reset link only opens the reset form; the customer signs in afterwards.
  if (recovery) return { ok: true, recovery: { userId: user.id } }

  const { error: trialError } = await supabase.rpc('start_trial')
  if (trialError) console.error('CARDLESS TRIAL CREATION ERROR (dashboard will retry):', trialError.message)

  return { ok: true }
}
