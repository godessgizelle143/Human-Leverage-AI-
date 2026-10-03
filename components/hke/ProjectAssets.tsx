'use client'

import { useState } from 'react'
import { HKE_ASSET_TYPES, HKE_ASSET_TYPE_KEYS, getHKEAssetLabel, type HKEAsset, type HKEAssetType } from '@/lib/hke/assets'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function downloadAsset(asset: HKEAsset) {
  const slug = asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || asset.asset_type
  const blob = new Blob([`${asset.title}\n\n${asset.content}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug}-v${asset.version}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ProjectAssets({ projectId, initialAssets }: { projectId: string; initialAssets: HKEAsset[] }) {
  const [assets, setAssets] = useState(initialAssets)
  const [building, setBuilding] = useState<HKEAssetType | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function buildAsset(assetType: HKEAssetType) {
    if (building) return
    const label = HKE_ASSET_TYPES[assetType].label
    setBuilding(assetType)
    setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ asset_type: assetType }),
      })
      const raw = await response.text()
      let data: { asset?: HKEAsset; error?: string } = {}
      try { data = JSON.parse(raw) } catch { /* handled below */ }
      if (!response.ok) throw new Error(data.error || `Asset builder returned HTTP ${response.status}.`)
      if (!data.asset) throw new Error('The asset builder returned no asset.')
      setAssets((previous) => [data.asset as HKEAsset, ...previous])
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to build your ${label.toLowerCase()}. Please try again.`)
    } finally {
      setBuilding(null)
    }
  }

  async function copyAsset(asset: HKEAsset) {
    try {
      await navigator.clipboard.writeText(`${asset.title}\n\n${asset.content}`)
      setCopiedId(asset.id)
      setTimeout(() => setCopiedId((current) => (current === asset.id ? null : current)), 2000)
    } catch {
      setError('Copy is not available in this browser. Use Download instead.')
    }
  }

  // Assets arrive newest first, so the first one seen per type is its latest version.
  const latestIds = new Set<string>()
  const seenTypes = new Set<string>()
  for (const asset of assets) {
    if (!seenTypes.has(asset.asset_type)) {
      seenTypes.add(asset.asset_type)
      latestIds.add(asset.id)
    }
  }

  return (
    <section className="mb-10 rounded-2xl border border-brand-gold/30 bg-white/5 p-6">
      <div>
        <p className="text-brand-gold font-semibold">Your assets</p>
        <h3 className="text-xl font-semibold mt-2">Generated assets</h3>
        <p className="text-white/70 mt-2 leading-7">
          HKE builds each asset only from the knowledge saved in this project: your interview, blueprint, and Steps 01–04.
          Anything it cannot support from your answers is left as a [bracketed placeholder] for you to fill in.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {HKE_ASSET_TYPE_KEYS.map((assetType) => {
          const definition = HKE_ASSET_TYPES[assetType]
          const isBuilding = building === assetType
          return (
            <div key={assetType} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-semibold">{definition.label}</h4>
                <p className="text-white/60 text-sm mt-1">{definition.description}</p>
              </div>
              <button type="button" onClick={() => buildAsset(assetType)} disabled={building !== null} className="btn-primary shrink-0 disabled:opacity-60 disabled:cursor-not-allowed">
                {isBuilding ? `Building ${definition.label}…` : `Build ${definition.label} →`}
              </button>
            </div>
          )
        })}
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}

      {assets.length === 0 ? (
        <p className="mt-6 text-white/50 text-sm">No assets yet. Build your first one above.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {assets.map((asset) => (
            <details key={asset.id} open={latestIds.has(asset.id)} className="group rounded-xl border border-white/10 bg-black/20 p-5">
              <summary className="flex cursor-pointer list-none flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <h4 className="text-lg font-semibold">
                  <span className="text-brand-gold mr-2 inline-block transition group-open:rotate-90">›</span>
                  {asset.title}
                </h4>
                <p className="text-white/50 text-sm shrink-0">
                  {getHKEAssetLabel(asset.asset_type)} · v{asset.version}{latestIds.has(asset.id) ? ' · latest' : ''}{asset.status !== 'completed' ? ` · ${asset.status}` : ''} · {formatDate(asset.created_at)}
                </p>
              </summary>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => copyAsset(asset)} className="btn-secondary text-sm">
                  {copiedId === asset.id ? 'Copied ✓' : 'Copy'}
                </button>
                <button type="button" onClick={() => downloadAsset(asset)} className="btn-secondary text-sm">
                  Download .txt
                </button>
              </div>
              <p className="text-white/80 leading-7 whitespace-pre-wrap mt-4">{asset.content}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
