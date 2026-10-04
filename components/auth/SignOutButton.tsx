'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      setSigningOut(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={handleSignOut} disabled={signingOut} className={`btn-secondary gap-2 disabled:opacity-60 ${compact ? '!px-3 !py-2 text-sm' : ''}`}>
        <LogOut className="w-4 h-4" />
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>
      {error && <p className="max-w-[16rem] text-right text-sm text-red-400">{error}</p>}
    </div>
  )
}
