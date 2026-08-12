import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            'flex h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white transition-all',
            'placeholder:text-zinc-600',
            'focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500/50 focus:ring-red-500/10',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs font-bold text-red-400 ml-1">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }