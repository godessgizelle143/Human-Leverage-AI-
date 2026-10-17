import type { CreditUsage, Usage } from '@/lib/hke/domain'
import { ProgressMeter } from './LifecycleBadge'

function creditLabel(credit: CreditUsage) {
  return credit.limit === null ? `${credit.used} used · unlimited` : `${credit.used} of ${credit.limit} used`
}

function percent(credit: CreditUsage) {
  return credit.limit ? Math.round((credit.used / credit.limit) * 100) : 0
}

/** Plan, period, and remaining generation capacity, straight from the subscription row. */
export default function UsagePanel({ usage, compact = false }: { usage: Usage | null; compact?: boolean }) {
  if (!usage) {
    return (
      <section className="glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-2">Choose your plan</h2>
        <p className="text-white/60">Start your 3-day free trial with no credit card required.</p>
      </section>
    )
  }

  const status = usage.plan === 'owner' ? 'Owner · test access' : !usage.active ? (usage.trialing ? 'Free trial ended' : 'Plan inactive') : usage.trialing ? `${usage.planLabel} · free trial` : `${usage.planLabel} · active`
  const periodEnd = usage.periodEnd ? new Date(usage.periodEnd) : null

  return (
    <section className={compact ? 'surface-inset rounded-xl p-4' : 'glass rounded-2xl p-6'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={compact ? 'text-sm font-semibold' : 'text-xl font-semibold'}>Generation capacity</h2>
          <p className="mt-1 text-sm text-white/60">{status}</p>
        </div>
        {periodEnd && usage.active && <p className="text-xs text-white/40 text-right">{usage.trialing ? 'Trial ends' : 'Renews'}<br />{periodEnd.toLocaleDateString()}</p>}
      </div>
      <div className="mt-4 space-y-3">
        <ProgressMeter value={percent(usage.interviews)} label={`Blueprints · ${creditLabel(usage.interviews)}`} showValue={usage.interviews.limit !== null} />
        <ProgressMeter value={percent(usage.builds)} label={`Build credits · ${creditLabel(usage.builds)}`} showValue={usage.builds.limit !== null} />
      </div>
      <p className="mt-3 text-xs text-white/40">A blueprint uses 1 blueprint + 1 build credit. Each generated asset uses 1 build credit. Failed generations are refunded.</p>
    </section>
  )
}
