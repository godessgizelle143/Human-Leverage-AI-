'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

/** Archives or restores a project (or a draft interview that has no project yet). */
export default function ArchiveButton({ kind, id, archived, className }: { kind: 'project' | 'interview'; id: string; archived: boolean; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    if (!archived && !window.confirm('Archive this project? You can restore it any time from your dashboard.')) return
    setBusy(true)
    setError('')
    const url = kind === 'project' ? `/api/projects/${id}` : `/api/interviews/${id}`
    const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !archived }) })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error || 'Unable to update this project.')
      setBusy(false)
      return
    }
    setBusy(false)
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={toggle} disabled={busy} className={clsx('text-sm text-white/50 hover:text-white disabled:opacity-50', className)}>
        {busy ? 'Saving…' : archived ? 'Restore' : 'Archive'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </span>
  )
}
