'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth/messages'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  // Errors from the auth callback arrive as fixed codes; show their message
  // once, then drop the code from the address bar.
  useEffect(() => {
    const message = authErrorMessage(new URLSearchParams(window.location.search).get('error'))
    if (message) {
      setError(message)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleResendConfirmation() {
    setResendState('sending')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) {
        setError('We could not resend the confirmation email right now. Please wait a moment and try again.')
        setResendState('idle')
        return
      }
      setResendState('sent')
    } catch {
      setError('We could not resend the confirmation email right now. Please wait a moment and try again.')
      setResendState('idle')
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnconfirmed(false)
    setResendState('idle')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        if (error.code === 'email_not_confirmed') {
          setUnconfirmed(true)
          setError('Please confirm your email before signing in. Check your inbox and spam folder for the confirmation link.')
        } else {
          setError(error.message)
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('SIGN IN ERROR:', err)
      setError('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/api/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (error) {
        setError(error.message)
        setGoogleLoading(false)
      }
    } catch (err) {
      console.error('GOOGLE LOGIN ERROR:', err)
      setError('Unable to start Google sign-in. Please try again.')
      setGoogleLoading(false)
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
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="text-white/60 mt-2">Sign in to continue building your empire</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400">
              {error}
              {unconfirmed && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendState !== 'idle' || !email.trim()}
                  className="mt-2 block text-sm font-semibold text-brand-gold hover:underline disabled:opacity-60 disabled:no-underline"
                >
                  {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? 'Confirmation email sent' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-white/60">Password</label>
                <Link
                  href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                  className="text-sm text-brand-gold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
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

            <button disabled={loading} className="btn-primary w-full py-3" type="submit">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="my-6 text-center text-white/40">OR</div>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="btn-secondary w-full py-3"
          >
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <p className="text-center text-white/50 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-gold">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
