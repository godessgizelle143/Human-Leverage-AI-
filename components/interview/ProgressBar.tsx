interface ProgressBarProps {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">
          Question {Math.min(current, total)} of {total}
        </span>
        <span className="text-sm font-medium text-brand-gold">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-brand transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
