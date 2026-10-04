'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { assetCategoryLabel, ASSET_TYPES, assetTypeLabel, displayStatus, type AssetDisplayStatus, type AssetSummary, type AssetTypeId } from '@/lib/hke/assets'

const STATUS_LABEL: Record<AssetDisplayStatus, string> = { generating: 'Generating…', completed: 'Ready', failed: 'Failed', interrupted: 'Interrupted' }
const CATEGORIES = Array.from(new Set(ASSET_TYPES.map((type) => type.category)))

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
  const [assets, setAssets] = useState(initialAssets)
  const [selected, setSelected] = useState<AssetTypeId>(ASSET_TYPES[0].id)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const otherGenerating = assets.some((asset) => displayStatus(asset) === 'generating')
  const selectedLabel = assetTypeLabel(selected)

  async function generate() {
    setGenerating(true)
    setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: selected }) })
      const data = (await response.json().catch(() => ({}))) as { asset?: AssetSummary; error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to generate this asset.')
      if (data.asset) setAssets((previous) => [data.asset!, ...previous.filter((asset) => asset.id !== data.asset!.id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate this asset.')
    } finally {
      setGenerating(false)
      router.refresh()
    }
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-7">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand-pink text-xs font-semibold uppercase tracking-wider">Build · Review</p>
          <h2 className="text-2xl font-bold">Generated Assets</h2>
        </div>
        <p className="text-sm text-white/50">{assets.filter((asset) => asset.status === 'completed').length} saved</p>
      </div>

      {assets.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => {
            const status = displayStatus(asset)
            return (
              <li key={asset.id}>
                {status === 'completed' ? (
                  <Link href={`/projects/${projectId}/assets/${asset.id}`} className="block h-full rounded-xl border border-white/10 bg-white/[.03] p-4 transition hover:border-brand-gold/40">
                    <AssetCard asset={asset} status={status} />
                    <p className="mt-3 text-sm text-brand-gold">View &amp; edit →</p>
                  </Link>
                ) : (
                  <div className={clsx('h-full rounded-xl border p-4', status === 'generating' ? 'border-brand-pink/30 bg-brand-pink/5' : 'border-red-400/20 bg-red-400/5')}>
                    <AssetCard asset={asset} status={status} />
                    {status === 'failed' && <p className="mt-2 text-sm text-red-200/80">{asset.error_message || 'Generation failed.'} No build credit was used.</p>}
                    {status === 'interrupted' && <p className="mt-2 text-sm text-red-200/80">Generation was interrupted. Its build credit will be refunded when you generate again.</p>}
                    {status === 'generating' && <button type="button" onClick={() => router.refresh()} className="mt-2 text-sm text-brand-gold">Check again</button>}
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
            {hasPlan ? 'You have used all build credits for this period.' : 'An active plan or trial is required to generate assets.'} <Link href="/dashboard#plans" className="text-brand-gold">See plans</Link>.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-5" role="radiogroup" aria-label="Asset type">
              {CATEGORIES.map((category) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">{assetCategoryLabel(category)}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ASSET_TYPES.filter((type) => type.category === category).map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        role="radio"
                        aria-checked={selected === type.id}
                        onClick={() => setSelected(type.id)}
                        className={clsx('rounded-xl border p-3 text-left transition', selected === type.id ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 hover:border-white/25')}
                      >
                        <span className="block text-sm font-semibold">{type.label}</span>
                        <span className="mt-1 block text-xs text-white/50">{type.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
            <button type="button" onClick={generate} disabled={generating || otherGenerating} className="btn-primary mt-5 w-full justify-center sm:w-auto disabled:opacity-60">
              {generating ? `Building your ${selectedLabel}…` : otherGenerating ? 'Another asset is generating…' : `Generate ${selectedLabel}`}
            </button>
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
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-pink">{assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` · v${asset.version}` : ''}</span>
        <span className={clsx('text-xs', status === 'completed' ? 'text-white/40' : status === 'generating' ? 'text-brand-gold animate-pulse' : 'text-red-300')}>
          {status === 'completed' ? new Date(asset.updated_at).toLocaleDateString() : STATUS_LABEL[status]}
        </span>
      </div>
      <h4 className="mt-1.5 font-semibold leading-snug">{asset.title}</h4>
    </>
  )
}
