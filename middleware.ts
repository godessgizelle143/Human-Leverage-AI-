import { createServerClient } from '@supabase/ssr'
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
            options?: {
              path?: string
              maxAge?: number
              expires?: Date
              httpOnly?: boolean
              secure?: boolean
              sameSite?: 'lax' | 'strict' | 'none'
            }
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

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

  const pathname = request.nextUrl.pathname

  if (
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/interview') ||
      pathname.startsWith('/projects') ||
      pathname.startsWith('/downloads') ||
      pathname.startsWith('/subscription') ||
      pathname.startsWith('/settings')) &&
    !user
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    (pathname === '/login' || pathname === '/register') &&
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
