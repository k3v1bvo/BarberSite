'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GalleryItem {
  id: string
  image_url: string
  categoria: string
  descripcion: string
  titulo?: string | null
}

interface GalleryCarouselProps {
  items: GalleryItem[]
  autoPlayMs?: number
  className?: string
}

export function GalleryCarousel({ items, autoPlayMs = 5000, className }: GalleryCarouselProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  const go = useCallback(
    (delta: number) => {
      setDirection(delta)
      setIndex((i) => (i + delta + items.length) % items.length)
    },
    [items.length]
  )

  useEffect(() => {
    if (items.length <= 1 || !autoPlayMs) return
    const t = setInterval(() => go(1), autoPlayMs)
    return () => clearInterval(t)
  }, [items.length, autoPlayMs, go])

  if (!items.length) return null

  const current = items[index]

  return (
    <div className={cn('space-y-4', className)}>
      <div className="relative aspect-[16/9] max-h-[520px] rounded-2xl overflow-hidden border border-white/10 group shadow-2xl">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              'absolute inset-0 transition-all duration-700 ease-out',
              idx === index
                ? 'opacity-100 scale-100 translate-x-0 z-10'
                : idx === (index - direction + items.length) % items.length
                  ? 'opacity-0 scale-105 -translate-x-full z-0'
                  : 'opacity-0 scale-95 translate-x-full z-0'
            )}
          >
            <img
              src={item.image_url}
              alt={item.titulo || item.descripcion || 'Galería'}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-20 pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-6 z-30 flex justify-between items-end gap-4">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              {current.categoria}
            </span>
            <p className="text-white font-bold text-lg mt-1 max-w-lg">
              {current.titulo || current.descripcion || 'Estilo Barber Pro'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/20 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all flex items-center justify-center"
              aria-label="Anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/20 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all flex items-center justify-center"
              aria-label="Siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-30 flex gap-1">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setDirection(idx > index ? 1 : -1)
                setIndex(idx)
              }}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                idx === index ? 'w-8 bg-amber-500' : 'w-2 bg-white/40 hover:bg-white/70'
              )}
              aria-label={`Ir a imagen ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setDirection(idx > index ? 1 : -1)
              setIndex(idx)
            }}
            className={cn(
              'shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300',
              idx === index
                ? 'border-amber-500 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/30'
            )}
          >
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
