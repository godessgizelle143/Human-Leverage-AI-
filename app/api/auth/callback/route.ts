import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const response = NextResponse.redirect(`${origin}/dashboard`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get('cookie')
            ?.split(';')
            .map((cookie) => {
              const [name, ...rest] = cookie.trim().split('=')

              return {
                name,
                value: rest.join('='),
              }
            }) ?? []
        },

        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: {
              path?: string
              domain?: string
              maxAge?: number
              expires?: Date
              httpOnly?: boolean
              secure?: boolean
              sameSite?: 'lax' | 'strict' | 'none'
            }
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return response
}
