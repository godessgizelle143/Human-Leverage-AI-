'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

const VARIANTS = { primary: 'btn-primary', gold: 'btn-gold' }

/** Creates a saved draft project, then opens its interview. */
export default function NewProjectButton({ className, label = 'Start a New Project', variant = 'primary' }: { className?: string; label?: string; variant?: keyof typeof VARIANTS }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createProject() {
    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.id) throw new Error(data.error || 'Unable to start a new project.')
      router.push(`/builder?interview=${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start a new project.')
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={createProject} disabled={creating} className={clsx(VARIANTS[variant], 'justify-center disabled:opacity-60', className)}>
        {creating ? 'Creating project…' : label}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
