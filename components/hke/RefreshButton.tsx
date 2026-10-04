'use client'

import { useRouter } from 'next/navigation'

export default function RefreshButton({ label = 'Check again' }: { label?: string }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.refresh()} className="text-sm font-semibold text-brand-gold hover:underline">
      {label}
    </button>
  )
}
