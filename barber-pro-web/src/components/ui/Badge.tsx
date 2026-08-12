import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase border transition-colors',
          {
            'bg-zinc-800 text-zinc-200 border-white/5': variant === 'default',
            'bg-green-500/10 text-green-500 border-green-500/20': variant === 'success',
            'bg-amber-500/10 text-amber-500 border-amber-500/20': variant === 'warning',
            'bg-red-500/10 text-red-500 border-red-500/20': variant === 'danger',
            'bg-blue-500/10 text-blue-500 border-blue-500/20': variant === 'info',
            'bg-transparent text-zinc-400 border-white/10': variant === 'outline',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }