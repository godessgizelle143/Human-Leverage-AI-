import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { isRecoveryFor, RECOVERY_COOKIE } from '@/lib/auth/recovery'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchParams = { code?: string | string[]; token_hash?: string | string[]; type?: string | string[] }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Where the customer chooses a new password. Reset links are completed by
 * /api/auth/callback, which signs the customer in for recovery and marks this
 * browser; the form opens only for that account while the marker lasts.
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  // A link that arrives here directly (an email sent before reset links went
  // through the callback, or an email template that points here) still
  // carries its one-time code or token: hand it to the callback to complete.
  const code = first(searchParams.code)
  const tokenHash = first(searchParams.token_hash)
  if (code) redirect(`/api/auth/callback?${new URLSearchParams({ code })}`)
  if (tokenHash) redirect(`/api/auth/callback?${new URLSearchParams({ token_hash: tokenHash, type: first(searchParams.type) ?? 'recovery' })}`)

  const cookieStore = await cookies()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ready = isRecoveryFor(cookieStore.get(RECOVERY_COOKIE)?.value, user?.id)

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-brand-gold" />
            <span className="text-2xl font-bold gradient-text">HKE AI</span>
          </Link>
          <h1 className="text-3xl font-bold">Choose a New Password</h1>
        </div>

        <div className="glass rounded-2xl p-8">
          <ResetPasswordForm initialStatus={ready ? 'ready' : 'invalid'} />
        </div>
      </div>
    </main>
  )
}
