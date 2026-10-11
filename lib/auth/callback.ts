import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'
import type { AuthErrorCode } from './messages'

/**
 * Email link types the callback may verify. Recovery links are excluded: they
 * go to /reset-password, which only unlocks for a PASSWORD_RECOVERY session.
 */
const CALLBACK_OTP_TYPES = new Set<EmailOtpType>(['signup', 'email', 'invite', 'magiclink', 'email_change'])

type CallbackAuth = Pick<SupabaseClient['auth'], 'exchangeCodeForSession' | 'verifyOtp' | 'getUser'>
type CallbackClient = { auth: CallbackAuth; rpc: SupabaseClient['rpc'] }

export type CallbackOutcome = { ok: true } | { ok: false; error: AuthErrorCode }

/**
 * Completes an OAuth, PKCE email, or token-hash email link and makes sure the
 * user has a subscription row. Ownership of the trial always comes from the
 * session (start_trial reads auth.uid()), never from the URL.
 *
 * A failed trial creation does not fail sign-in: the user is authenticated,
 * start_trial is idempotent, and the dashboard retries it on every load.
 */
export async function completeAuthCallback(supabase: CallbackClient, params: URLSearchParams): Promise<CallbackOutcome> {
  const providerError = params.get('error')
  if (providerError) return { ok: false, error: providerError === 'access_denied' ? 'oauth-cancelled' : 'oauth-failed' }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('AUTH CALLBACK CODE EXCHANGE ERROR:', error.message)
      return { ok: false, error: 'link-invalid' }
    }
  } else if (tokenHash && type && CALLBACK_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.error('AUTH CALLBACK OTP ERROR:', error.message)
      return { ok: false, error: 'link-invalid' }
    }
  } else {
    return { ok: false, error: 'missing-code' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'session-failed' }

  const { error: trialError } = await supabase.rpc('start_trial')
  if (trialError) console.error('CARDLESS TRIAL CREATION ERROR (dashboard will retry):', trialError.message)

  return { ok: true }
}
