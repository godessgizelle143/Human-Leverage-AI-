import clsx from 'clsx'
import { assetTypeLabel, type AssetSummary } from '@/lib/hke/assets'
import { latestAssetsByType } from '@/lib/hke/kit'
import { STEP_SECTIONS } from '@/lib/hke/steps'

type Props = {
  projectId: string
  assets: AssetSummary[]
  hasBlueprint: boolean
  planStepsDone: number
  answered: number
}

function Included({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={clsx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
          done ? 'bg-gradient-brand text-brand-black' : 'border border-white/20 text-white/40',
        )}
      >
        {done ? '✓' : '–'}
      </span>
      <span className={clsx('min-w-0 break-words', done ? 'text-white/80' : 'text-white/40')}>{children}</span>
    </li>
  )
}

/**
 * Deploy: everything HKE built from this project's knowledge, downloadable as
 * one document. Mirrors what /api/projects/[id]/kit puts in the file.
 */
export default function KnowledgeKitPanel({ projectId, assets, hasBlueprint, planStepsDone, answered }: Props) {
  const completed = assets.filter((asset) => asset.status === 'completed')
  const included = latestAssetsByType(completed)
  const olderVersions = completed.length - included.length

  return (
    <section id="kit" className="scroll-mt-24 relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 via-white/[.02] to-brand-pink/10 p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-gold">Deploy · take it with you</p>
      <h2 className="mt-1 text-2xl font-bold">Your Knowledge Kit</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        Everything HKE AI has built from what you know, in one document: your blueprint, launch plan, and the latest version of every asset — with your own interview answers as the source.
      </p>

      <ul className="mt-5 grid gap-2.5 text-sm sm:grid-cols-2" aria-label="Included in your kit">
        <Included done={hasBlueprint}>Knowledge blueprint</Included>
        <Included done={planStepsDone > 0}>
          Launch plan{planStepsDone > 0 && planStepsDone < STEP_SECTIONS.length ? ` · ${planStepsDone} of ${STEP_SECTIONS.length} steps` : ''}
        </Included>
        {included.map((asset) => (
          <Included key={asset.id} done>
            {asset.title} <span className="text-white/40">· {assetTypeLabel(asset.asset_type)}{asset.version > 1 ? ` v${asset.version}` : ''}</span>
          </Included>
        ))}
        <Included done={answered > 0}>Your interview answers</Included>
      </ul>

      {included.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
          No assets in your kit yet. <a href="#assets" className="font-semibold text-brand-gold hover:underline">Generate your first asset</a> and it&apos;s added automatically.
        </p>
      ) : (
        olderVersions > 0 && (
          <p className="mt-4 text-xs text-white/45">
            {olderVersions} older version{olderVersions === 1 ? ' is' : 's are'} kept in your workspace but left out of the kit.
          </p>
        )
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a href={`/api/projects/${projectId}/kit?format=html`} className="btn-primary justify-center">Download kit (print-ready → PDF)</a>
        <a href={`/api/projects/${projectId}/kit?format=md`} className="btn-secondary justify-center">Markdown (.md)</a>
      </div>
      <p className="mt-3 text-xs text-white/40">Open the print-ready file and choose Print → Save as PDF. Each part starts on a new page.</p>
    </section>
  )
}
