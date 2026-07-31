import { Sparkles, Check } from 'lucide-react'

interface PricingCardProps {
  name: string
  price: string
  features: string[]
  isCurrent: boolean
  isPopular?: boolean
  onSelect: () => void
}

export default function PricingCard({ name, price, features, isCurrent, isPopular, onSelect }: PricingCardProps) {
  return (
    <div className={`rounded-2xl p-6 transition-all duration-300 ${
      isPopular
        ? 'bg-gradient-to-b from-brand-gold/10 to-brand-pink/10 border border-brand-gold/30 scale-105'
        : 'glass glass-hover'
    }`}>
      {isPopular && (
        <div className="text-brand-gold text-xs font-semibold uppercase mb-2">Most Popular</div>
      )}
      <h3 className="text-xl font-bold mb-1">{name}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold gradient-text">{price}</span>
        <span className="text-white/40 text-sm">/month</span>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-white/70">
            <Check className="w-4 h-4 text-brand-gold flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <div className="text-center py-2 px-4 rounded-lg bg-white/5 text-white/40 text-sm">
          Current Plan
        </div>
      ) : (
        <button onClick={onSelect} className={isPopular ? 'btn-primary w-full text-sm' : 'btn-secondary w-full text-sm'}>
          {isCurrent ? 'Current Plan' : 'Upgrade'}
        </button>
      )}
    </div>
  )
}
