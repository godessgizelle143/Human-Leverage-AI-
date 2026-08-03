import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')

  if (!code) {
    console.log('NO AUTH CODE RECEIVED')

    return NextResponse.redirect(
      `${origin}/login?error=no-code`
    )
  }

  const cookieStore = await cookies()

  const response = NextResponse.redirect(
    `${origin}/dashboard`
  )

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
            options?: {
              [key: string]: any
            }
          }[]
        ) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              )
            }
          )
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
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  console.log('AUTH SUCCESS - REDIRECTING TO DASHBOARD')

  return response
}
