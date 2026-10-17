'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { assetCategoryLabel, ASSET_TYPES, assetTypeLabel, displayStatus, mergeAssetLists, type AssetDisplayStatus, type AssetSummary, type AssetTypeId } from '@/lib/hke/assets'

const STATUS_LABEL: Record<AssetDisplayStatus, string> = { generating: 'Generating…', completed: 'Ready', failed: 'Failed', interrupted: 'Interrupted' }
const CATEGORIES = Array.from(new Set(ASSET_TYPES.map((type) => type.category)))
const POLL_MS = 5000

type Props = {
  projectId: string
  initialAssets: AssetSummary[]
  archived: boolean
  canGenerate: boolean
  hasPlan: boolean
  /** null means unlimited. */
  buildsRemaining: number | null
}

export default function AssetStudio({ projectId, initialAssets, archived, canGenerate, hasPlan, buildsRemaining }: Props) {
  const router = useRouter()
  // initialAssets is the server's list and changes on every router.refresh();
  // `created` only bridges the moment between a generation and that refresh.
  const [created, setCreated] = useState<AssetSummary[]>([])
  const assets = mergeAssetLists(initialAssets, created)
  const [selected, setSelected] = useState<AssetTypeId>(ASSET_TYPES[0].id)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const otherGenerating = assets.some((asset) => displayStatus(asset) === 'generating')

  // A generation started in another tab, or one whose request this page lost,
  // finishes on the server; keep checking until it settles or goes stale.
  useEffect(() => {
    if (!otherGenerating || generating) return
    const timer = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [otherGenerating, generating, router])

  const ready = created[0]
  const selectedLabel = assetTypeLabel(selected)
  const [category, setCategory] = useState(ASSET_TYPES[0].category as (typeof CATEGORIES)[number])
  const selectedVersions = assets.filter((asset) => asset.asset_type === selected && asset.status === 'completed').length

  async function generate() {
    setGenerating(true)
    setError('')
    setCreated([])
    try {
      const response = await fetch(`/api/projects/${projectId}/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: selected }) })
      const data = (await response.json().catch(() => ({}))) as { asset?: AssetSummary; error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to generate this asset.')
      if (data.asset) setCreated((previous) => [data.asset!, ...previous.filter((asset) => asset.id !== data.asset!.id)])
    } catch (err) {
      // fetch rejects with a TypeError when the response never arrived; the server may still finish.
      setError(err instanceof TypeError ? 'The connection dropped before HKE AI answered. Your asset may still be generating; it will appear below when it is ready.' : err instanceof Error ? err.message : 'Unable to generate this asset.')
    } finally {
      setGenerating(false)
      router.refresh()
    }
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-7">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-lg font-semibold">Your assets</h3>
        <p className="text-sm text-white/50">{assets.filter((asset) => asset.status === 'completed').length} saved</p>
      </div>

      {assets.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => {
            const status = displayStatus(asset)
            return (
              <li key={asset.id}>
                {status === 'completed' ? (
                  <Link href={`/projects/${projectId}/assets/${asset.id}`} className="surface-inset card-link block h-full rounded-xl p-4">
                    <AssetCard asset={asset} status={status} />
                    <p className="link-action mt-3 text-sm">View &amp; edit →</p>
                  </Link>
                ) : (
                  <div className={clsx('h-full rounded-xl border p-4', status === 'generating' ? 'border-brand-pink/30 bg-brand-pink/5' : 'border-red-400/20 bg-red-400/5')}>
                    <AssetCard asset={asset} status={status} />
                    {status === 'failed' && <p className="mt-2 text-sm text-red-200/80">{asset.error_message || 'Generation failed.'} No build credit was used.</p>}
                    {status === 'interrupted' && <p className="mt-2 text-sm text-red-200/80">Generation was interrupted. Its build credit will be refunded when you generate again.</p>}
                    {status === 'generating' && <button type="button" onClick={() => router.refresh()} className="link-action mt-2 text-sm">Check again</button>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 text-white/60">No assets yet. Choose what HKE AI should build from your knowledge.</p>
      )}

      <div className="mt-8 border-t border-white/10 pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="font-semibold">Create a new asset</h3>
          {hasPlan && <p className="text-xs text-white/50">{buildsRemaining === null ? 'Unlimited build credits' : `${buildsRemaining} build credit${buildsRemaining === 1 ? '' : 's'} left · each asset uses 1`}</p>}
        </div>
        {archived ? (
          <p className="mt-2 text-sm text-white/50">Restore this project to generate new assets.</p>
        ) : !canGenerate ? (
          <p className="mt-2 text-sm text-white/50">
            {hasPlan ? 'You have used all build credits for this period.' : 'An active plan or trial is required to generate assets.'} <Link href="/dashboard#plans" className="link-action">See plans</Link>.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Asset categories">
              {CATEGORIES.map((item) => (
                <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={clsx('chip', category === item && 'chip-active')}>
                  {assetCategoryLabel(item)} <span className="text-white/40">{ASSET_TYPES.filter((type) => type.category === item).length}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Asset type">
              {ASSET_TYPES.filter((type) => type.category === category).map((type) => {
                const existing = assets.filter((asset) => asset.asset_type === type.id && asset.status === 'completed').length
                return (
                  <button
                    key={type.id}
                    type="button"
                    role="radio"
                    aria-checked={selected === type.id}
                    onClick={() => setSelected(type.id)}
                    className={clsx('rounded-xl border p-4 text-left transition', selected === type.id ? 'border-brand-pink bg-brand-pink/10' : 'border-white/10 hover:border-white/25')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{type.label}</span>
                      {existing > 0 && <span className="shrink-0 text-[11px] font-semibold text-brand-gold">{existing} saved</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/50">{type.description}</span>
                  </button>
                )
              })}
            </div>
            {error && <div role="alert" className="notice notice-error mt-4">{error}</div>}
            {ready?.status === 'completed' && !error && (
              <div role="status" className="notice notice-success mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Your {assetTypeLabel(ready.asset_type)} is saved to this project.</span>
                <Link href={`/projects/${projectId}/assets/${ready.id}`} className="link-action shrink-0">Open &amp; edit it →</Link>
              </div>
            )}
            <div className="surface-inset mt-5 flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Ready to build</p>
                <p className="mt-1 font-semibold">{selectedLabel}{selectedVersions > 0 && <span className="ml-2 text-sm font-normal text-white/50">saved as version {selectedVersions + 1}</span>}</p>
              </div>
              <button type="button" onClick={generate} disabled={generating || otherGenerating} className="btn-primary w-full shrink-0 justify-center sm:w-auto disabled:opacity-60">
                {generating ? `Building your ${selectedLabel}…` : otherGenerating ? 'Another asset is generating…' : `Generate ${selectedLabel}`}
              </button>
            </div>
            <p className="mt-2 text-xs text-white/40">Generation usually takes 15–45 seconds. If it fails, the build credit is refunded.</p>
          </>
        )}
      </div>
    </section>
  )
}

function AssetCard({ asset, status }: { asset: AssetSummary; status: AssetDisplayStatus }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-gold">{assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` · v${asset.version}` : ''}</span>
        <span className={clsx('inline-flex items-center gap-1.5 text-xs', status === 'completed' ? 'text-white/45' : status === 'generating' ? 'text-brand-pink animate-pulse' : 'text-red-300')}>
          {status === 'completed' && <span className="status-dot" title={STATUS_LABEL.completed} aria-hidden />}
          {status === 'completed' ? new Date(asset.updated_at).toLocaleDateString() : STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-1.5 font-semibold leading-snug break-words">{asset.title}</p>
    </>
  )
}
