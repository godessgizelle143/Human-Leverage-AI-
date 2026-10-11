/**
 * Error codes the auth callback puts in `/login?error=<code>`, and the
 * notices the dashboard reads from its query string. Only these fixed
 * messages are ever shown, so a crafted link cannot put arbitrary text on
 * the page.
 */
export const AUTH_ERROR_MESSAGES = {
  'oauth-cancelled': 'Google sign-in was cancelled. Choose an option below to continue.',
  'oauth-failed': 'We could not complete sign-in with Google. Please try again.',
  'link-invalid':
    'This sign-in link is invalid, has expired, or was opened in a different browser. If you just confirmed your email, sign in with your password below.',
  'missing-code': 'That sign-in link is incomplete. Please sign in below or request a new link.',
  'session-failed': 'We could not start your session. Please sign in again.',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return code in AUTH_ERROR_MESSAGES ? AUTH_ERROR_MESSAGES[code as AuthErrorCode] : 'Something went wrong while signing you in. Please try again.'
}

export type DashboardNotice = { tone: 'success' | 'info' | 'error'; message: string }

const CHECKOUT_NOTICES: Record<string, DashboardNotice> = {
  success: { tone: 'success', message: 'Payment received. Your plan updates here within a minute; refresh if it has not changed yet.' },
  cancelled: { tone: 'info', message: 'Checkout was cancelled. You have not been charged.' },
}

const ERROR_NOTICES: Record<string, DashboardNotice> = {
  'already-subscribed': { tone: 'info', message: 'You already have an active subscription.' },
  'payment-required': { tone: 'error', message: 'Your last payment did not go through. Update your payment method from the receipt email Stripe sent you, then try again.' },
  'subscription-needs-attention': { tone: 'error', message: 'Your subscription needs attention before you can change plans. Please contact support.' },
  'payment-pending': { tone: 'info', message: 'A payment for your account is still processing. Your plan updates here once it clears; there is no need to check out again.' },
  'checkout-retry': { tone: 'error', message: 'An earlier checkout for your account is still open, so we did not start a new one. Wait a minute, then choose your plan again.' },
  'checkout-unavailable': { tone: 'error', message: 'Checkout is temporarily unavailable. Please try again in a few minutes.' },
  'invalid-plan': { tone: 'error', message: 'That plan is not available. Please choose one of the plans below.' },
}

/** The notice for `/dashboard?checkout=…` or `/dashboard?error=…`, if any. */
export function dashboardNotice(params: { checkout?: string | string[]; error?: string | string[] }): DashboardNotice | null {
  const checkout = typeof params.checkout === 'string' ? params.checkout : undefined
  const error = typeof params.error === 'string' ? params.error : undefined
  return (error && ERROR_NOTICES[error]) || (checkout && CHECKOUT_NOTICES[checkout]) || null
}
