import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { completeAuthCallback } from '@/lib/auth/callback'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const cookieStore = await cookies()
  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))

  // Session cookies are written only onto the success redirect.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const outcome = await completeAuthCallback(supabase, requestUrl.searchParams)
  if (!outcome.ok) return NextResponse.redirect(new URL(`/login?error=${outcome.error}`, request.url))

  redirectResponse.headers.set('Cache-Control', 'private, no-store')
  return redirectResponse
}
