'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AdminPageHeaderProps {
  title: string
  highlight?: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function AdminPageHeader({
  title,
  highlight,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  const dateLabel = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header
      className={cn(
        'flex flex-col gap-6 border-b border-white/5 pb-8 animate-in fade-in slide-in-from-top-2 duration-500',
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 capitalize">
            {dateLabel}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none">
            {title}{' '}
            {highlight ? <span className="text-amber-500">{highlight}</span> : null}
          </h1>
          {description ? (
            <p className="text-zinc-500 font-medium text-base max-w-xl">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div> : null}
      </div>
    </header>
  )
}
