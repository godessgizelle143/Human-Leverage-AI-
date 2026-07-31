import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="text-sm text-white/60 mb-1 block">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold/50 transition-colors',
              icon ? 'pl-10 pr-4' : 'px-4',
              error && 'border-red-500/50 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs mt-1">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
