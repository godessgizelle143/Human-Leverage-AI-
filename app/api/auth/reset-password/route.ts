import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { isRecoveryFor, newPasswordProblem, RECOVERY_COOKIE } from '@/lib/auth/recovery'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const EXPIRED = { error: 'This password reset link is invalid or has expired. Please request a new one.', code: 'recovery-expired' } as const

/**
 * Saves the new password chosen on /reset-password. Only works while the
 * browser holds a recovery session opened by a reset link for the signed-in
 * account (see lib/auth/recovery.ts); afterwards the customer signs in again
 * with the new password.
 */
export async function POST(request: Request) {
  let body: { password?: unknown; confirmPassword?: unknown } = {}
  try {
    const parsed = await request.json()
    if (parsed && typeof parsed === 'object') body = parsed
  } catch {
    // Treated as an empty body below.
  }

  const cookieStore = await cookies()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isRecoveryFor(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) {
    return NextResponse.json(EXPIRED, { status: 401 })
  }

  const problem = newPasswordProblem(body.password, body.confirmPassword)
  if (problem) return NextResponse.json({ error: problem, code: 'invalid-password' }, { status: 400 })

  const { error } = await supabase.auth.updateUser({ password: body.password as string })
  if (error) {
    if (isAuthSessionMissingError(error)) {
      cookieStore.delete(RECOVERY_COOKIE)
      return NextResponse.json(EXPIRED, { status: 401 })
    }
    if (error.code === 'same_password') {
      return NextResponse.json({ error: 'Choose a password that is different from your current one.', code: 'invalid-password' }, { status: 400 })
    }
    if (error.code === 'weak_password') {
      // Supabase's message lists the password rules that were not met.
      return NextResponse.json({ error: error.message, code: 'invalid-password' }, { status: 400 })
    }
    console.error('PASSWORD UPDATE ERROR:', error.message)
    return NextResponse.json({ error: 'Unable to update your password. Please try again.', code: 'update-failed' }, { status: 500 })
  }

  // The password is changed at this point. Require a fresh sign-in with it,
  // but never report a failed sign-out as a failed update.
  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) console.error('POST-RESET SIGN OUT ERROR:', signOutError.message)
  } catch (signOutError) {
    console.error('POST-RESET SIGN OUT ERROR:', signOutError instanceof Error ? signOutError.message : 'Unknown error')
  }
  cookieStore.delete(RECOVERY_COOKIE)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
