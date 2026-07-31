'use client'

import { MessageSquare, Zap, Calendar } from 'lucide-react'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subtext: string
  color: string
}

function StatCard({ icon, label, value, subtext, color }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-5 glass-hover transition-all duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/40 mt-1">{subtext}</p>
    </div>
  )
}

export default function UsageStats() {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-8">
      <StatCard
        icon={<MessageSquare className="w-5 h-5 text-brand-gold" />}
        label="Interviews Remaining"
        value="3 / 5"
        subtext="2 used this month"
        color="bg-brand-gold/10"
      />
      <StatCard
        icon={<Zap className="w-5 h-5 text-brand-pink" />}
        label="Builds Remaining"
        value="4 / 5"
        subtext="1 used this month"
        color="bg-brand-pink/10"
      />
      <StatCard
        icon={<Calendar className="w-5 h-5 text-blue-400" />}
        label="Reset Date"
        value="Feb 15"
        subtext="15 days until refresh"
        color="bg-blue-400/10"
      />
    </div>
  )
}
