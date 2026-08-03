'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/dashboard')
      router.refresh()

    } catch (error) {
      setError('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')

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
      }

    } catch (error) {
      setError('Google sign in failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-black">

      <div className="absolute inset-0 bg-gradient-radial from-brand-gold/3 via-transparent to-transparent" />

      <div className="w-full max-w-md relative z-10">

        <div className="text-center mb-8">

          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            <span className="text-2xl font-bold gradient-text">
              Human Leverage AI™
            </span>
          </Link>

          <h1 className="text-3xl font-bold mb-2">
            Welcome Back
          </h1>

          <p className="text-white/60">
            Sign in to continue building your empire
          </p>

        </div>


        <div className="glass rounded-2xl p-8">

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}


          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >

            <div>
              <label className="text-sm text-white/60 block mb-1">
                Email
              </label>

              <div className="relative">

                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
                />

              </div>
            </div>


            <div>

              <label className="text-sm text-white/60 block mb-1">
                Password
              </label>

              <div className="relative">

                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                >

                  {showPassword
                    ? <EyeOff className="w-5 h-5" />
                    : <Eye className="w-5 h-5" />
                  }

                </button>

              </div>

            </div>


            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>


          </form>


          <div className="relative my-6">

            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>

            <div className="relative flex justify-center">
              <span className="px-4 bg-brand-black text-white/40 text-sm">
                or continue with
              </span>
            </div>

          </div>


          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="btn-secondary w-full py-3"
          >
            {googleLoading
              ? 'Connecting to Google...'
              : 'Continue with Google'
            }
          </button>


          <p className="text-center text-white/40 text-sm mt-6">

            Don't have an account?{' '}

            <Link
              href="/register"
              className="text-brand-gold"
            >
              Sign up free
            </Link>

          </p>


        </div>

      </div>

    </main>
  )
}
