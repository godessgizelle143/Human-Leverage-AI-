import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) return NextResponse.redirect(new URL('/login?error=no-code', request.url))

  const cookieStore = await cookies()
  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('CALLBACK ERROR:', error.message)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()

  // New users receive a cardless 3-day application trial. Existing Stripe
  // subscriptions are preserved and never overwritten here.
  if (user) {
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingSubscription) {
      const started = new Date()
      const ends = new Date(started.getTime() + 3 * 24 * 60 * 60 * 1000)

      const { error: trialError } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'professional',
        status: 'trialing',
        interviews_used: 0,
        builds_used: 0,
        current_period_start: started.toISOString(),
        current_period_end: ends.toISOString(),
        trial_started_at: started.toISOString(),
        stripe_customer_id: null,
        stripe_subscription_id: null,
      })

      if (trialError) console.error('CARDLESS TRIAL CREATION ERROR:', trialError.message)
    }
  }

  return redirectResponse
}
