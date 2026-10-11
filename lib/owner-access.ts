import type { User } from '@supabase/supabase-js'

export function isHumanLeverageOwner(email: string | null | undefined): boolean {
  if (!email) return false

  const configured = process.env.HUMAN_LEVERAGE_OWNER_EMAILS ?? ''
  const allowedEmails = configured
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.trim().toLowerCase())
}

/**
 * Owner access for a server-verified user (from auth.getUser(), never from
 * the request). The address must also be confirmed, so an unverified signup
 * using an owner's email can never skip entitlements.
 */
export function isOwnerUser(user: Pick<User, 'email' | 'email_confirmed_at'> | null | undefined): boolean {
  return !!user?.email_confirmed_at && isHumanLeverageOwner(user.email)
}
