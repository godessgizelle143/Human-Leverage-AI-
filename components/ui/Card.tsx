import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  gradient?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = true, gradient = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'glass rounded-2xl p-6',
          hover && 'glass-hover transition-all duration-300',
          gradient && 'bg-gradient-to-b from-brand-gold/5 to-brand-pink/5 border-brand-gold/20',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
export default Card
