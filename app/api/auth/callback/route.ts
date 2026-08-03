import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')

  if (!code) {
    console.log('NO AUTH CODE RECEIVED')
    return NextResponse.redirect(
      new URL('/login?error=no_code', request.url)
    )
  }

  const response = NextResponse.redirect(
    new URL('/dashboard', request.url)
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet) {
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

  const { error } =
    await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.log(
      'AUTH CALLBACK ERROR:',
      error.message
    )

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    )
  }

  return response
}
