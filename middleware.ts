import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
  if (pathname === '/') {
    return response
  }

  // Keep authenticated users out of the public login/register pages.
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Only protect the dashboard when there is no authenticated session.
  // If the request already carries a Supabase auth cookie, preserve the
  // response/session cookies instead of immediately bouncing the user back
  // to login during first-request session propagation.
  if (pathname.startsWith('/dashboard') && !user) {
    const hasSupabaseAuthCookie = request.cookies
      .getAll()
      .some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))

    if (!hasSupabaseAuthCookie) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
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
