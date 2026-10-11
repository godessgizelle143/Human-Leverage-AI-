'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Lock, Eye, EyeOff } from 'lucide-react'
import { isAuthSessionMissingError } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8

// How long to wait for PASSWORD_RECOVERY once the client has a session, and
// the overall cap so the page never stays on "Verifying" indefinitely.
const RECOVERY_EVENT_GRACE_MS = 2000
const RECOVERY_TIMEOUT_MS = 15000

type Status = 'checking' | 'ready' | 'invalid' | 'done'

// Only a recovery link can open this form: a PKCE `code` in the query string,
// or `type=recovery` in the hash for the implicit flow.
function hasRecoveryParams(): boolean {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.has('code') || hash.get('type') === 'recovery'
}

// Supabase reports a failed or expired recovery link via error params in the
// query string (PKCE) or the hash (implicit flow).
function readLinkError(): string | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    query.get('error_description') ||
    hash.get('error_description') ||
    query.get('error') ||
    hash.get('error')
  )
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let settled = false
    const timers: number[] = []
    const supabase = createClient()

    // Resolve the page exactly once, then drop the one-time code or error
    // params from the address bar.
    const settle = (next: 'ready' | 'invalid') => {
      if (!active || settled) return
      settled = true
      timers.forEach(clearTimeout)
      setStatus(next)
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    if (readLinkError() || !hasRecoveryParams()) {
      setStatus('invalid')
      return
    }

    // The browser client exchanges the recovery `code` during initialization
    // and emits PASSWORD_RECOVERY only for a session created from a reset
    // link. Any other session (e.g. an existing sign-in, which Supabase keeps
    // when the exchange fails) must not unlock the form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        settle('ready')
      }
    })

    timers.push(window.setTimeout(() => settle('invalid'), RECOVERY_TIMEOUT_MS))

    // getSession resolves once initialization (and the code exchange) is done.
    // With no session the link failed; with one, PASSWORD_RECOVERY is emitted
    // right after, so give it a short grace period before giving up.
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error || !session) {
          settle('invalid')
          return
        }
        timers.push(window.setTimeout(() => settle('invalid'), RECOVERY_EVENT_GRACE_MS))
      })
      .catch(err => {
        console.error('PASSWORD RECOVERY SESSION ERROR:', err)
        settle('invalid')
      })

    return () => {
      active = false
      timers.forEach(clearTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setLoading(false)
        // The recovery session expired or was cleared; a new link is needed.
        if (isAuthSessionMissingError(error)) {
          setStatus('invalid')
          return
        }
        setError(error.message)
        return
      }
    } catch (err) {
      console.error('PASSWORD UPDATE ERROR:', err)
      setError('Unable to update your password. Please try again.')
      setLoading(false)
      return
    }

    // The password is changed at this point. Require a fresh sign-in with the
    // new password, but never report a failed local sign-out as a failed update.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) console.error('POST-RESET SIGN OUT ERROR:', error.message)
    } catch (err) {
      console.error('POST-RESET SIGN OUT ERROR:', err)
    }

    setLoading(false)
    setStatus('done')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            <span className="text-2xl font-bold gradient-text">HKE AI</span>
          </Link>
          <h1 className="text-3xl font-bold">Choose a New Password</h1>
        </div>

        <div className="glass rounded-2xl p-8">
          {status === 'checking' && (
            <p className="text-center text-white/60">Verifying your reset link...</p>
          )}

          {status === 'invalid' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
                This password reset link is invalid or has expired. Please request a new one and
                open it in the same browser you requested it from.
              </div>
              <Link href="/forgot-password" className="btn-primary w-full py-3 block text-center">
                Request a New Link
              </Link>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                Your password has been updated. Sign in with your new password to continue.
              </div>
              <Link href="/login" className="btn-primary w-full py-3 block text-center">
                Go to Sign In
              </Link>
            </div>
          )}

          {status === 'ready' && (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/60">New Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-white/40"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/60">Confirm New Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button disabled={loading} className="btn-primary w-full py-3" type="submit">
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
