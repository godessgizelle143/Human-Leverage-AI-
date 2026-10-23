'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BrandMark from '@/components/hke/BrandMark'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      } else if (data.session) {
        // Cardless trial starts when the authenticated user reaches the dashboard.
        window.location.href = '/dashboard'
      } else {
        setResendSent(false)
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email.trim()) return
    setResendLoading(true)
    setError('')
    setResendSent(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) setError(error.message)
      else setResendSent(true)
    } catch {
      setError('We could not resend the email right now. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
        setGoogleLoading(false)
      }
    } catch {
      setError('Unable to start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  if (success) {
    return (
      <div className="backdrop-spot min-h-screen flex items-center justify-center px-6 py-10 bg-brand-black">
        <div className="w-full max-w-md text-center">
          <div className="mb-6"><BrandMark size="lg" wordmark={false} /></div>
          <h1 className="text-3xl font-bold mb-4">Check Your Email</h1>
          <p className="text-white/60 mb-4">
            We sent a confirmation link to <span className="font-semibold text-white">{email}</span>.
          </p>
          <p className="text-sm text-white/40 mb-6">
            Your 3-day free trial requires no credit card. Open the email and click the confirmation link to activate your HKE account.
            If you do not see it, check your spam or junk folder.
          </p>

          {error && <div role="alert" className="notice notice-error mb-4">{error}</div>}
          {resendSent && <div role="status" className="notice notice-success mb-4">A fresh confirmation email has been sent. Check your inbox and spam folder.</div>}

          <button type="button" onClick={handleResend} disabled={resendLoading} className="btn-primary w-full py-3 mb-3 disabled:opacity-50 disabled:cursor-not-allowed">
            {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
          </button>
          <button type="button" onClick={() => { setSuccess(false); setError(''); setResendSent(false) }} className="btn-secondary w-full py-3 mb-3">
            Use a Different Email
          </button>
          <Link href="/login" className="link-action text-sm">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="backdrop-spot min-h-screen flex items-center justify-center px-6 py-10 bg-brand-black">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex mb-6"><BrandMark size="lg" /></Link>
          <h1 className="text-3xl font-bold mb-2">Start Your Free Trial</h1>
          <p className="text-white/60">3 days completely free · No credit card required</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <p className="mb-5 text-sm text-white/60">Create your HKE account with your email and a password just for HKE.</p>
          {error && <div role="alert" className="notice notice-error mb-4">{error}</div>}
          <form onSubmit={handleRegister} className="space-y-4">
            <div><label className="text-sm text-white/60 mb-1 block">Full Name</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="field !py-3 !pl-10 !pr-4" placeholder="Your full name" required /></div></div>
            <div><label className="text-sm text-white/60 mb-1 block">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field !py-3 !pl-10 !pr-4" placeholder="you@example.com" required /></div></div>
            <div><label className="text-sm text-white/60 mb-1 block">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="field !py-3 !pl-10 !pr-12" placeholder="••••••••" required minLength={8} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div><p className="text-xs text-white/30 mt-1">Minimum 8 characters</p></div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Creating your free trial...' : 'Start My 3-Day Free Trial'}</button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">Signed up with Google before?{' '}<button type="button" onClick={handleGoogleSignup} disabled={googleLoading} className="link-action disabled:opacity-60">{googleLoading ? 'Connecting...' : 'Continue with Google'}</button></p>
          <p className="text-center text-white/40 text-sm mt-6">Already have an account? <Link href="/login" className="link-action">Sign in</Link></p>
        </div>

        <p className="text-center text-xs text-white/40 mt-5">No credit card. No payment today. Choose a paid plan only if you want to continue after your free trial.</p>
      </div>
    </div>
  )
}
