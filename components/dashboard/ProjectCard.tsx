import { Clock, CheckCircle, Loader } from 'lucide-react'

interface ProjectCardProps {
  title: string
  status: 'completed' | 'in-progress'
  date: string
  type: string
}

export default function ProjectCard({ title, status, date, type }: ProjectCardProps) {
  return (
    <div className="glass rounded-xl p-6 glass-hover transition-all duration-300 cursor-pointer">
      <div className="flex items-center gap-2 mb-3">
        {status === 'completed' ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Loader className="w-4 h-4 text-brand-gold animate-spin" />
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          status === 'completed' ? 'bg-green-400/10 text-green-400' : 'bg-brand-gold/10 text-brand-gold'
        }`}>
          {status === 'completed' ? 'Complete' : 'In Progress'}
        </span>
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-white/40 mb-3">{type}</p>
      <p className="text-xs text-white/30 flex items-center gap-1">
        <Clock className="w-3 h-3" /> {date}
      </p>
    </div>
  )
}
