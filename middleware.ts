import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Local demo preview has no Supabase credentials; skip auth middleware.
  // This bypass is disabled in production.
  if (process.env.NODE_ENV !== 'production' && process.env.HKE_DEMO_MODE === '1') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: CookieOptions
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({
              name,
              value,
              ...options,
            })

            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // The root route is always the public marketing landing page.
  // Do not redirect authenticated users away from `/` so the public entry
  // point remains testable and shareable.
  if (pathname === '/') {
    // Supabase sends an email link to the site's root when the link's own
    // return address is not on the project's allow-list. The one-time code or
    // token is still valid, so pass it to the callback instead of dropping it.
    const { searchParams } = request.nextUrl
    if (searchParams.has('code') || searchParams.has('token_hash')) {
      const callback = request.nextUrl.clone()
      callback.pathname = '/api/auth/callback'
      return NextResponse.redirect(callback)
    }
    return response
  }

  // Keep authenticated users out of the public login/register pages.
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/login',
    '/register',
    '/interview/:path*',
    '/projects/:path*',
    '/downloads/:path*',
    '/subscription/:path*',
    '/settings/:path*',
  ],
}
