'use client'

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger'
  delay?: number
}

export function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
  variant = 'default',
  delay = 0,
}: StatCardProps) {
  const styles = {
    default: 'bg-zinc-900 border-white/5 hover:border-amber-500/30',
    primary: 'bg-amber-500 text-black border-none glow-amber',
    danger: 'bg-red-500/10 border-red-500/20 hover:border-red-500/40',
  }

  const labelStyles = {
    default: 'text-zinc-500',
    primary: 'text-black/60',
    danger: 'text-red-400',
  }

  const valueStyles = {
    default: 'text-white',
    primary: 'text-black',
    danger: 'text-red-500',
  }

  const iconStyles = {
    default: 'text-zinc-800',
    primary: 'text-black/20',
    danger: 'text-red-500/40',
  }

  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        styles[variant],
        onClick && 'cursor-pointer btn-press hover:scale-[1.02] transition-all duration-300',
        'animate-in fade-in slide-in-from-bottom-3 fill-mode-both'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={cn('text-[10px] uppercase font-black tracking-widest', labelStyles[variant])}>
              {label}
            </p>
            <p className={cn('text-3xl sm:text-4xl font-black mt-2 leading-none truncate', valueStyles[variant])}>
              {value}
            </p>
          </div>
          <Icon className={cn('w-10 h-10 shrink-0', iconStyles[variant])} />
        </div>
      </CardContent>
    </Card>
  )
}
