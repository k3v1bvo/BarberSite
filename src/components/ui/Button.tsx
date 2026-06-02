import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-bold transition-all btn-press disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          {
            'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/10': variant === 'primary',
            'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/5': variant === 'secondary',
            'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20': variant === 'danger',
            'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20': variant === 'success',
            'bg-transparent border border-white/10 text-zinc-300 hover:border-amber-500/50 hover:text-amber-500': variant === 'outline',
            'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5': variant === 'ghost',
            
            'px-4 py-1.5 text-xs': size === 'sm',
            'px-5 py-2.5 text-sm': size === 'md',
            'px-6 py-3.5 text-base': size === 'lg',
            'px-8 py-4 text-lg font-black uppercase tracking-wider': size === 'xl',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }