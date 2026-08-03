import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {

  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')

  const origin = new URL(request.url).origin


  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=no-code`
    )
  }


  const response = NextResponse.redirect(
    `${origin}/dashboard`
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

            response.cookies.set(
              name,
              value,
              options
            )

          })

        },
      },
    }
  )


  const { error } =
    await supabase.auth.exchangeCodeForSession(code)


  if (error) {

    console.log(
      "AUTH CALLBACK ERROR:",
      error.message
    )

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }


  return response
}
