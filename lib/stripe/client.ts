import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.VERCEL_ENV === 'preview'
      ? process.env.STRIPE_TEST_SECRET_KEY
      : process.env.STRIPE_SECRET_KEY

    if (!secretKey) {
      throw new Error(
        process.env.VERCEL_ENV === 'preview'
          ? 'STRIPE_TEST_SECRET_KEY is not configured for the Preview environment'
          : 'STRIPE_SECRET_KEY is not configured for the Production environment'
      )
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    })
  }
  return stripeClient
}

export const PRICING_PLANS = {
  creator: {
    name: 'Creator',
    price: 4700,
    interviews: 5,
    builds: 5,
    features: ['5 AI interviews/month', '5 content builds/month', 'PDF exports', 'Email support'],
  },
  professional: {
    name: 'Professional',
    price: 9700,
    interviews: 25,
    builds: 25,
    features: ['25 AI interviews/month', '25 content builds/month', 'Priority PDF exports', 'Priority support', 'Advanced templates'],
  },
  business: {
    name: 'Business Pro',
    price: 19700,
    interviews: -1,
    builds: -1,
    features: ['Unlimited interviews', 'Unlimited builds', 'Premium templates', 'Dedicated support', 'API access', 'White-label options'],
  },
} as const

export type PlanKey = keyof typeof PRICING_PLANS
