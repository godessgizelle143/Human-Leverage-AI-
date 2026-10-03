'use client'

import { useState } from 'react'
import { getHKEAssetLabel, type HKEAsset } from '@/lib/hke/assets'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function ProjectAssets({ projectId, initialAssets }: { projectId: string; initialAssets: HKEAsset[] }) {
  const [assets, setAssets] = useState(initialAssets)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')

  async function buildSalesPage() {
    if (building) return
    setBuilding(true)
    setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ asset_type: 'sales_page' }),
      })
      const raw = await response.text()
      let data: { asset?: HKEAsset; error?: string } = {}
      try { data = JSON.parse(raw) } catch { /* handled below */ }
      if (!response.ok) throw new Error(data.error || `Asset builder returned HTTP ${response.status}.`)
      if (!data.asset) throw new Error('The asset builder returned no asset.')
      setAssets((previous) => [data.asset as HKEAsset, ...previous])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build your sales page. Please try again.')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <section className="mb-10 rounded-2xl border border-brand-gold/30 bg-white/5 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-brand-gold font-semibold">Your assets</p>
          <h3 className="text-xl font-semibold mt-2">Generated assets</h3>
          <p className="text-white/70 mt-2 leading-7">Build reusable assets from your interview, blueprint, and saved steps.</p>
        </div>
        <button type="button" onClick={buildSalesPage} disabled={building} className="btn-primary shrink-0 disabled:opacity-60 disabled:cursor-not-allowed">
          {building ? 'Building Sales Page…' : 'Build Sales Page →'}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}

      {assets.length === 0 ? (
        <p className="mt-6 text-white/50 text-sm">No assets yet. Build your first sales page to get started.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {assets.map((asset) => (
            <article key={asset.id} className="rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <h4 className="text-lg font-semibold">{asset.title}</h4>
                <p className="text-white/50 text-sm shrink-0">
                  {getHKEAssetLabel(asset.asset_type)} · v{asset.version} · {asset.status} · {formatDate(asset.created_at)}
                </p>
              </div>
              <p className="text-white/80 leading-7 whitespace-pre-wrap mt-4">{asset.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
