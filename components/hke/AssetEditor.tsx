'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const [deleting, setDeleting] = useState(false)
  // What the server last confirmed. Compared against this, not the page's
  // props, so a save counts as soon as it succeeds rather than after a refresh.
  const [saved, setSaved] = useState({ title: asset.title, content: asset.content })
  const dirty = title !== saved.title || content !== saved.content
  const canSave = dirty && !saving && title.trim().length > 0

  const save = useCallback(async () => {
    // The server trims the title; save the same value it will store.
    const snapshot = { title: title.trim(), content }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(data.error || 'Unable to save this asset.'); return }
      setSaved(snapshot)
      setTitle((current) => (current === title ? snapshot.title : current))
      setSavedAt(data.savedAt ? new Date(data.savedAt) : new Date())
      router.refresh()
    } catch {
      setError('Could not reach HKE AI. Check your connection — your edits are still here — and save again.')
    } finally {
      setSaving(false)
    }
  }, [asset.id, content, projectId, router, title])

  // Leaving the page: the browser prompt covers reloads and closing the tab;
  // the click guard covers in-app links, which never fire beforeunload.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return
      if (!window.confirm('You have unsaved changes to this asset. Leave without saving?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLinks, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', guardLinks, true)
    }
  }, [dirty])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (canSave) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSave, save])

  async function remove() {
    if (!window.confirm('Delete this asset permanently?')) return
    setDeleting(true)
    setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, { method: 'DELETE' })
      if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || 'Unable to delete this asset.'); setDeleting(false); return }
      router.push(`/projects/${projectId}#assets`)
      router.refresh()
    } catch {
      setError('Could not reach HKE AI. Check your connection and try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="eyebrow">{typeLabel}{asset.version > 1 ? ` · version ${asset.version}` : ''}</p>
      {mode === 'edit' ? (
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} aria-label="Asset title" className="field mt-2 !px-4 !py-3 text-2xl font-bold" />
      ) : (
        <h1 className="mt-2 text-3xl font-bold break-words">{title}</h1>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-white/10 p-1">
          {(['view', 'edit'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={clsx('rounded-md px-4 py-1.5 text-sm capitalize', mode === value ? 'bg-brand-pink font-semibold text-brand-black' : 'text-white/60 hover:text-white')}>{value}</button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={!canSave} title="Save (Ctrl/⌘ + S)" className="btn-primary !py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        <span className="inline-flex items-center gap-2 text-sm text-white/50" aria-live="polite">{!title.trim() ? 'Add a title to save' : dirty ? 'Unsaved changes' : savedAt ? <><span className="status-dot" aria-hidden />{`Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</> : ''}</span>
      </div>

      {error && <div role="alert" className="notice notice-error mt-4">{error}</div>}

      <div className="mt-6 glass rounded-2xl p-5 sm:p-8">
        {mode === 'edit' ? (
          <>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={28} aria-label="Asset content" className="field !bg-black/40 font-mono text-sm leading-6" />
            <p className="mt-2 text-xs text-white/40">Formatting: # Heading, ## Subheading, - bullet, 1. numbered, **bold**, *italic*.</p>
          </>
        ) : (
          <Markdown source={content} />
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="text-white/50">Export{dirty ? ' (saved version)' : ''}:</span>
          <a href={`/api/projects/${projectId}/assets/${asset.id}/export?format=md`} className="link-action">Markdown (.md)</a>
          <a href={`/api/projects/${projectId}/assets/${asset.id}/export?format=html`} className="link-action">Print-ready (.html → PDF)</a>
        </div>
        <button type="button" onClick={remove} disabled={deleting} className="text-sm text-red-300/80 hover:text-red-200 self-start sm:self-auto disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete asset'}</button>
      </div>
    </div>
  )
}
