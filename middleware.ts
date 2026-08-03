import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const protectedRoutes = [
    '/dashboard',
    '/interview',
    '/projects',
    '/downloads',
    '/subscription',
    '/settings',
  ]

  if (
    protectedRoutes.some((route) => path.startsWith(route)) &&
    !user
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    (path === '/login' || path === '/register') &&
    user
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/interview/:path*',
    '/projects/:path*',
    '/downloads/:path*',
    '/subscription/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
}
