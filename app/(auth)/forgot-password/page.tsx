'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Mail } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  // Prefill from the Sign In form when the user followed "Forgot password?".
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('email')
    if (prefill) setEmail(prefill)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      // Supabase does not report whether the address has an account, so any
      // error here is operational (rate limit, network). Keep the message
      // generic either way so account existence is never revealed.
      if (error) {
        console.error('PASSWORD RESET REQUEST ERROR:', error.message)
        setError('We could not send a reset email right now. Please wait a moment and try again.')
        return
      }

      setSent(true)
    } catch (err) {
      console.error('PASSWORD RESET REQUEST ERROR:', err)
      setError('We could not send a reset email right now. Please wait a moment and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            <span className="text-2xl font-bold gradient-text">HKE AI</span>
          </Link>
          <h1 className="text-3xl font-bold">Reset Your Password</h1>
          <p className="text-white/60 mt-2">
            Enter your email and we&apos;ll send you a link to choose a new password
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                If an account exists for <span className="font-semibold">{email.trim()}</span>, a
                password reset link is on its way. Check your inbox and spam folder.
              </div>
              <p className="text-sm text-white/40">
                Open the link in this same browser. It expires after a short time; if it does,
                request a new one.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="btn-secondary w-full py-3"
              >
                Send Another Link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-white/60">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button disabled={loading} className="btn-primary w-full py-3" type="submit">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="text-center text-white/50 text-sm mt-6">
            Remembered it?{' '}
            <Link href="/login" className="text-brand-gold">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
