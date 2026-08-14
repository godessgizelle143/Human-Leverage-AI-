import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const origin = new URL(request.url).origin

  const cookiesToSet: {
    name: string
    value: string
    options?: CookieOptions
  }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error || !data.url) {
    console.error('GOOGLE OAUTH ERROR:', error?.message || 'No OAuth URL returned')
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error?.message || 'Google login failed')}`,
        request.url
      )
    )
  }

  const response = NextResponse.redirect(data.url)

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
