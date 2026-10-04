'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import type { ProjectAssetRow } from '@/lib/hke/db'
import Markdown from './Markdown'

export type EditableAsset = Pick<ProjectAssetRow, 'id' | 'title' | 'content' | 'version'>

export default function AssetEditor({ projectId, asset, typeLabel }: { projectId: string; asset: EditableAsset; typeLabel: string }) {
  const router = useRouter()
  const [title, setTitle] = useState(asset.title)
  const [content, setContent] = useState(asset.content)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const dirty = title !== asset.title || content !== asset.content

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save() {
    setSaving(true)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) { setError(data.error || 'Unable to save this asset.'); return }
    setSavedAt(new Date())
    router.refresh()
  }

  async function remove() {
    if (!window.confirm('Delete this asset permanently?')) return
    const response = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, { method: 'DELETE' })
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || 'Unable to delete this asset.'); return }
    router.push(`/projects/${projectId}#assets`)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-pink">{typeLabel}{asset.version > 1 ? ` · version ${asset.version}` : ''}</p>
      {mode === 'edit' ? (
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} aria-label="Asset title" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-bold outline-none focus:border-brand-gold" />
      ) : (
        <h1 className="mt-2 text-3xl font-bold break-words">{title}</h1>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-white/10 p-1">
          {(['view', 'edit'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={clsx('rounded-md px-4 py-1.5 text-sm capitalize', mode === value ? 'bg-gradient-brand font-semibold text-brand-black' : 'text-white/60 hover:text-white')}>{value}</button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary !py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        <span className="text-sm text-white/50" aria-live="polite">{dirty ? 'Unsaved changes' : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}

      <div className="mt-6 glass rounded-2xl p-5 sm:p-8">
        {mode === 'edit' ? (
          <>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={28} aria-label="Asset content" className="w-full rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm leading-6 text-white outline-none focus:border-brand-gold" />
            <p className="mt-2 text-xs text-white/40">Formatting: # Heading, ## Subheading, - bullet, 1. numbered, **bold**, *italic*.</p>
          </>
        ) : (
          <Markdown source={content} />
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="text-white/50">Export{dirty ? ' (saved version)' : ''}:</span>
          <a href={`/api/projects/${projectId}/assets/${asset.id}/export?format=md`} className="text-brand-gold hover:underline">Markdown (.md)</a>
          <a href={`/api/projects/${projectId}/assets/${asset.id}/export?format=html`} className="text-brand-gold hover:underline">Print-ready (.html → PDF)</a>
        </div>
        <button type="button" onClick={remove} className="text-sm text-red-300/80 hover:text-red-200 self-start sm:self-auto">Delete asset</button>
      </div>
    </div>
  )
}
