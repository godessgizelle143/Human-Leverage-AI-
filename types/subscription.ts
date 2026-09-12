export type PlanType = 'creator' | 'professional' | 'business'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

export interface Subscription {
  id: string
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  plan: PlanType
  status: SubscriptionStatus
  interviewsUsed: number
  buildsUsed: number
  currentPeriodStart: string
  currentPeriodEnd: string
}

export interface PlanLimits {
  interviews: number
  builds: number
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  creator: { interviews: 5, builds: 5 },
  professional: { interviews: 15, builds: 15 },
  business: { interviews: 25, builds: 25 },
}

export interface PricingPlan {
  name: string
  type: PlanType
  price: number
  priceDisplay: string
  features: string[]
  isPopular?: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Creator',
    type: 'creator',
    price: 47,
    priceDisplay: '$47',
    features: ['5 AI interviews/month', '5 content builds/month', 'PDF exports', 'Email support'],
  },
  {
    name: 'Professional',
    type: 'professional',
    price: 97,
    priceDisplay: '$97',
    features: ['15 AI interviews/month', '15 content builds/month', 'Priority PDF exports', 'Priority support', 'Advanced templates'],
    isPopular: true,
  },
  {
    name: 'Business Pro',
    type: 'business',
    price: 197,
    priceDisplay: '$197',
    features: ['25 AI interviews/month', '25 content builds/month', 'Premium templates', 'Dedicated support', 'API access', 'White-label options'],
  },
]
