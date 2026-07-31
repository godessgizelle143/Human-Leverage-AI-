import { Clock } from 'lucide-react'

interface UsageTrackerProps {
  label: string
  used: number
  total: number
  resetDate: string
}

export default function UsageTracker({ label, used, total, resetDate }: UsageTrackerProps) {
  const percentage = (used / total) * 100
  const remaining = total - used

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{label}</h3>
        <span className="text-sm text-white/40 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Resets in {resetDate}
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-bold">{remaining} <span className="text-sm font-normal text-white/40">remaining</span></span>
        <span className="text-sm text-white/60">{used}/{total} used</span>
      </div>
      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-brand-gold' : 'bg-green-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
