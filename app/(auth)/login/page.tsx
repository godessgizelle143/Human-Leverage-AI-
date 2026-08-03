'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }


  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          'https://human-leverage-ai.vercel.app/api/auth/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('GOOGLE LOGIN ERROR:', error.message)
      setError(error.message)
      setGoogleLoading(false)
    }
  }


  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-black px-6">

      <div className="w-full max-w-md">

        <div className="text-center mb-8">

          <Link href="/" className="inline-flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            <span className="text-2xl font-bold gradient-text">
              Human Leverage AI™
            </span>
          </Link>

          <h1 className="text-3xl font-bold mt-6">
            Welcome Back
          </h1>

          <p className="text-white/60">
            Sign in to continue building your empire
          </p>

        </div>


        <div className="glass rounded-2xl p-8">

          {error && (
            <div className="mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}


          <form onSubmit={handleLogin} className="space-y-4">

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/5"
              required
            />


            <div className="relative">

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className="w-full p-3 rounded-lg bg-white/5"
                required
              />

              <button
                type="button"
                onClick={()=>setShowPassword(!showPassword)}
                className="absolute right-3 top-3"
              >
                {showPassword ? <EyeOff/> : <Eye/>}
              </button>

            </div>


            <button
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>


          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="btn-secondary w-full py-3 mt-6"
          >
            {googleLoading
              ? 'Connecting...'
              : 'Continue with Google'}
          </button>


          <p className="text-center mt-6 text-white/50">

            Don't have an account?{' '}

            <Link href="/register" className="text-brand-gold">
              Sign up
            </Link>

          </p>

        </div>

      </div>

    </main>
  )
}
