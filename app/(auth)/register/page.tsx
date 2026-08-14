'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
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
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) setError(error.message)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-brand-black">
        <div className="w-full max-w-md text-center">
          <Sparkles className="w-16 h-16 text-brand-gold mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Check Your Email</h1>
          <p className="text-white/60 mb-4">
            We sent a confirmation link to <span className="text-brand-gold">{email}</span>.
          </p>
          <p className="text-sm text-white/40 mb-6">
            Your 3-day free trial requires no credit card. Open the email and click the confirmation link to activate your Human Leverage AI™ account.
            If you do not see it, check your spam or junk folder.
          </p>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          {resendSent && <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">A fresh confirmation email has been sent. Check your inbox and spam folder.</div>}

          <button type="button" onClick={handleResend} disabled={resendLoading} className="btn-primary w-full py-3 mb-3 disabled:opacity-50 disabled:cursor-not-allowed">
            {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
          </button>
          <button type="button" onClick={() => { setSuccess(false); setError(''); setResendSent(false) }} className="btn-secondary w-full py-3 mb-3">
            Use a Different Email
          </button>
          <Link href="/login" className="text-brand-gold hover:text-brand-pink transition-colors text-sm">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-brand-black">
      <div className="absolute inset-0 bg-gradient-radial from-brand-pink/3 via-transparent to-transparent" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6"><Sparkles className="w-8 h-8 text-brand-gold" /><span className="text-2xl font-bold gradient-text">Human Leverage AI™</span></Link>
          <h1 className="text-3xl font-bold mb-2">Start Your Free Trial</h1>
          <p className="text-white/60">3 days completely free · No credit card required</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleRegister} className="space-y-4">
            <div><label className="text-sm text-white/60 mb-1 block">Full Name</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold/50 transition-colors" placeholder="Your full name" required /></div></div>
            <div><label className="text-sm text-white/60 mb-1 block">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold/50 transition-colors" placeholder="you@example.com" required /></div></div>
            <div><label className="text-sm text-white/60 mb-1 block">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold/50 transition-colors" placeholder="••••••••" required minLength={8} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div><p className="text-xs text-white/30 mt-1">Minimum 8 characters</p></div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Creating your free trial...' : 'Start My 3-Day Free Trial'}</button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div><div className="relative flex justify-center text-sm"><span className="px-4 bg-brand-black text-white/40">or continue with</span></div></div>
          <button onClick={handleGoogleSignup} className="btn-secondary w-full py-3 flex items-center justify-center gap-2"><svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C1.43 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button>
          <p className="text-center text-white/40 text-sm mt-6">Already have an account? <Link href="/login" className="text-brand-gold hover:text-brand-pink transition-colors">Sign in</Link></p>
        </div>

        <p className="text-center text-xs text-white/40 mt-5">No credit card. No payment today. Choose a paid plan only if you want to continue after your free trial.</p>
      </div>
    </div>
  )
}
