import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no-code', request.url))
  }

  const cookieStore = await cookies()
  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: CookieOptions
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('CALLBACK ERROR:', error.message)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login?error=missing-user', request.url)
    )
  }

  // Authentication is complete at this point.
  // Trial provisioning is intentionally handled by the dashboard so a
  // billing/trial database issue can never force a successful login back
  // to the login page.
  //
  // This keeps the OAuth callback responsible only for:
  // 1. exchanging the PKCE code
  // 2. persisting the Supabase session cookies
  // 3. redirecting the authenticated user
  redirectResponse.headers.set('Cache-Control', 'private, no-store')

  return redirectResponse
}
