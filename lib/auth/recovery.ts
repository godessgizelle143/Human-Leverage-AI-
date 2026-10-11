/**
 * Password recovery, shared by the auth callback, the reset-password page,
 * and the route that saves the new password.
 *
 * A recovery link is completed on the server by /api/auth/callback, which
 * then marks the browser with a short-lived cookie naming the recovered
 * account. The reset form opens only while that marker matches the signed-in
 * user, so an ordinary sign-in can never be used to open it.
 */
export const RECOVERY_COOKIE = 'hke-recovery'

/** How long the customer has to choose a new password after opening the link. */
export const RECOVERY_MAX_AGE_SECONDS = 15 * 60

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

export function recoveryCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: RECOVERY_MAX_AGE_SECONDS }
}

/** True when the marker cookie names this signed-in user. */
export function isRecoveryFor(marker: string | null | undefined, userId: string | null | undefined) {
  return !!marker && !!userId && marker === userId
}

/** The message to show for an unusable new password, or null when it is acceptable. */
export function newPasswordProblem(password: unknown, confirmPassword: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password.length > MAX_PASSWORD_LENGTH) return `Password can be at most ${MAX_PASSWORD_LENGTH} characters.`
  if (password !== confirmPassword) return 'Passwords do not match.'
  return null
}
