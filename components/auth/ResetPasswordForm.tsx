'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, newPasswordProblem } from '@/lib/auth/recovery'

type Status = 'ready' | 'invalid' | 'done'

/**
 * The reset-password form. The page decides on the server whether a reset
 * link was opened for the signed-in account and passes that in; this form
 * never unlocks itself.
 */
export default function ResetPasswordForm({ initialStatus }: { initialStatus: 'ready' | 'invalid' }) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const problem = newPasswordProblem(password, confirmPassword)
    if (problem) {
      setError(problem)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      })
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; code?: string }

      if (response.ok && data.ok) {
        setPassword('')
        setConfirmPassword('')
        setStatus('done')
        return
      }
      // The recovery session expired or was cleared; a new link is needed.
      if (data.code === 'recovery-expired') {
        setStatus('invalid')
        return
      }
      setError(data.error || 'Unable to update your password. Please try again.')
    } catch (err) {
      console.error('PASSWORD UPDATE ERROR:', err)
      setError('Unable to update your password. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'invalid') {
    return (
      <div className="space-y-4">
        <div className="notice notice-error" role="alert">
          This password reset link is invalid or has expired. Please request a new one and
          open it in the same browser you requested it from.
        </div>
        <Link href="/forgot-password" className="btn-primary w-full justify-center py-3">
          Request a New Link
        </Link>
        <p className="text-center text-white/50 text-sm">
          Remembered it?{' '}
          <Link href="/login" className="link-action">Back to Sign In</Link>
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="space-y-4">
        <div className="notice notice-success" role="status">
          Your password has been updated. Sign in with your new password to continue.
        </div>
        <Link href="/login" className="btn-primary w-full justify-center py-3">
          Go to Sign In
        </Link>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="notice notice-error mb-4" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="text-sm text-white/60">New Password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-white/30" />
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="field !py-3 !pl-10 !pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
              className="absolute right-3 top-3 text-white/40"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-white/40">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-sm text-white/60">Confirm New Password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-white/30" />
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="field !py-3 !pl-10 !pr-12"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button disabled={loading} className="btn-primary w-full py-3" type="submit">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </>
  )
}
