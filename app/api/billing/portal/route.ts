import { NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe/client'
import { STRIPE_REQUEST_LIMITS } from '@/lib/stripe/limits'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function dashboardRedirect(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/dashboard?error=${error}`, request.url), 303)
}

/**
 * "Manage billing": sends the signed-in person to the Stripe Customer Portal,
 * where they update their card, see invoices, and cancel. Cancelling takes
 * effect at the end of the billing period (set in the portal's Stripe
 * settings); the webhook records the change, so nothing is written here.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }

  const { data, error } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (error) {
    console.error('BILLING PORTAL READ ERROR:', error.message)
    return dashboardRedirect(request, 'billing-unavailable')
  }

  const customerId = data?.stripe_customer_id
  if (!customerId) return dashboardRedirect(request, 'no-billing')

  try {
    const session = await getStripeClient().billingPortal.sessions.create(
      { customer: customerId, return_url: `${new URL(request.url).origin}/dashboard` },
      STRIPE_REQUEST_LIMITS,
    )
    return NextResponse.redirect(session.url, 303)
  } catch (error) {
    console.error('BILLING PORTAL ERROR:', error instanceof Error ? error.message : 'Unknown error')
    return dashboardRedirect(request, 'billing-unavailable')
  }
}
