import { assetTypeLabel, type AssetSummary } from '@/lib/hke/assets'
import { latestAssetsByType } from '@/lib/hke/kit'
import { STEP_SECTIONS } from '@/lib/hke/steps'

type Props = {
  projectId: string
  title: string
  assets: AssetSummary[]
  hasBlueprint: boolean
  planStepsDone: number
  answered: number
}

/**
 * Deploy: everything HKE built from this project's knowledge, downloadable as
 * one document. The sheet on the left is the kit's cover and contents page in
 * miniature; both mirror what /api/projects/[id]/kit puts in the file.
 */
export default function KnowledgeKitPanel({ projectId, title, assets, hasBlueprint, planStepsDone, answered }: Props) {
  const completed = assets.filter((asset) => asset.status === 'completed')
  const included = latestAssetsByType(completed)
  const olderVersions = completed.length - included.length

  // Same parts, same order, same wording as buildKit in lib/hke/kit.ts.
  const parts = [
    ...(hasBlueprint ? [{ key: 'blueprint', heading: 'Knowledge Blueprint', label: 'What HKE AI extracted from your interview' }] : []),
    ...(planStepsDone > 0 ? [{ key: 'plan', heading: 'Launch Plan', label: 'Your decisions for taking it to market' }] : []),
    ...included.map((asset) => ({ key: asset.id, heading: asset.title, label: `${assetTypeLabel(asset.asset_type)}${asset.version > 1 ? ` · version ${asset.version}` : ''}` })),
    ...(answered > 0 ? [{ key: 'interview', heading: 'Source: Your Interview', label: 'The knowledge everything above was built from' }] : []),
  ]
  const missing = [
    ...(planStepsDone < STEP_SECTIONS.length ? [{ key: 'plan', href: '#plan', text: planStepsDone ? `${STEP_SECTIONS.length - planStepsDone} launch plan step${STEP_SECTIONS.length - planStepsDone === 1 ? '' : 's'} still to decide` : 'Your launch plan, once you make the first decision' }] : []),
    ...(included.length === 0 ? [{ key: 'assets', href: '#assets', text: 'Your first asset, added automatically when it is generated' }] : []),
  ]

  return (
    <div className="panel-feature grid gap-8 rounded-2xl p-5 sm:p-7 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <div className="paper mx-auto w-full max-w-xs self-start p-4 font-serif lg:max-w-none" aria-label="Preview of your kit's cover and contents">
        <div className="rounded-sm border-l-4 border-brand-pink bg-brand-black px-4 py-5 text-white">
          <p className="font-sans text-[9px] font-semibold uppercase tracking-[.2em] text-brand-pink">Knowledge Kit</p>
          <p className="mt-1.5 border-b-2 border-brand-gold pb-1.5 text-xl font-bold leading-tight break-words">{title}</p>
          <p className="mt-2 text-[10px] italic text-white/70">Speak Once. Build Forever. · Built with HKE AI</p>
        </div>
        <p className="mt-4 text-sm font-bold text-brand-pink">Contents</p>
        <ol className="mt-1.5 space-y-1.5 text-xs leading-5">
          {parts.map((part, index) => (
            <li key={part.key} className="flex gap-2">
              <span className="w-4 shrink-0 font-bold text-brand-gold">{index + 1}.</span>
              <span className="min-w-0 break-words">{part.heading} <span className="text-black/45">— {part.label}</span></span>
            </li>
          ))}
        </ol>
        {parts.length === 0 && <p className="mt-1.5 text-xs text-black/50">Nothing to include yet.</p>}
      </div>

      <div className="min-w-0">
        <p className="text-lg font-semibold leading-snug">Everything HKE AI has built from what you know, in one document you can print, send, or keep.</p>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Your blueprint, your launch plan, and the latest version of every asset — closing with your own interview answers as the source.
        </p>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Parts', value: parts.length },
            { label: 'Assets', value: included.length },
            { label: 'Plan steps', value: `${planStepsDone}/${STEP_SECTIONS.length}` },
          ].map((stat) => (
            <div key={stat.label} className="surface-inset rounded-xl p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{stat.label}</dt>
              <dd className="mt-1.5 text-2xl font-extrabold leading-none">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {missing.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Not in your kit yet</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {missing.map((item) => (
                <li key={item.key} className="flex gap-2 text-white/60">
                  <span className="text-white/30" aria-hidden>–</span>
                  <a href={item.href} className="hover:text-white hover:underline">{item.text}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {olderVersions > 0 && (
          <p className="mt-4 text-xs text-white/45">
            {olderVersions} older version{olderVersions === 1 ? ' is' : 's are'} kept in your workspace but left out of the kit.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href={`/api/projects/${projectId}/kit?format=html`} className="btn-primary">Download kit (print-ready → PDF)</a>
          <a href={`/api/projects/${projectId}/kit?format=md`} className="btn-secondary">Markdown (.md)</a>
        </div>
        <p className="mt-3 text-xs text-white/40">Open the print-ready file and choose Print → Save as PDF. Each part starts on a new page.</p>
      </div>
    </div>
  )
}
