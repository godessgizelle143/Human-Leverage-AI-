import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { completeAuthCallback } from '@/lib/auth/callback'
import { RECOVERY_COOKIE, recoveryCookieOptions } from '@/lib/auth/recovery'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const cookieStore = await cookies()

  // Session cookies are collected here and written only onto a success redirect.
  const sessionCookies: { name: string; value: string; options?: CookieOptions }[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) { sessionCookies.push(...cookiesToSet) },
      },
    }
  )

  const outcome = await completeAuthCallback(supabase, requestUrl.searchParams)
  if (!outcome.ok) {
    // A failed password-reset link goes back to the reset page, which offers a new link.
    const destination = outcome.recovery ? '/reset-password?error=link-invalid' : `/login?error=${outcome.error}`
    return NextResponse.redirect(new URL(destination, request.url))
  }

  const response = NextResponse.redirect(new URL(outcome.recovery ? '/reset-password' : '/dashboard', request.url))
  sessionCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))

  if (outcome.recovery) {
    // Marks this browser as having opened a reset link for this account.
    response.cookies.set(RECOVERY_COOKIE, outcome.recovery.userId, recoveryCookieOptions(requestUrl.protocol === 'https:'))
  } else {
    // An ordinary sign-in never leaves the reset form open.
    response.cookies.delete(RECOVERY_COOKIE)
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
