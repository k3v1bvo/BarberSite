'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'

interface ServicioGalleryBannerProps {
  imagenes: string[]
  categoria?: string
  aspectRatio?: string
  showBadge?: boolean
}

export function ServicioGalleryBanner({
  imagenes = [],
  categoria = 'Cortes',
  aspectRatio = 'aspect-[16/9]',
  showBadge = true
}: ServicioGalleryBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (!imagenes || imagenes.length === 0) return null

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveIndex((prev) => (prev - 1 + imagenes.length) % imagenes.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveIndex((prev) => (prev + 1) % imagenes.length)
  }

  return (
    <div className={`relative ${aspectRatio} w-full overflow-hidden bg-zinc-950 border-b border-white/10 group/banner`}>
      <img
        src={imagenes[activeIndex]}
        alt={`Servicio foto ${activeIndex + 1}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-500 group-hover/banner:scale-105"
      />

      {/* Categoría Badge */}
      {showBadge && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          <span className="text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-amber-400 border border-amber-400/30">
            {categoria}
          </span>
          {imagenes.length > 1 && (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/80 text-white border border-white/20">
              {activeIndex + 1}/{imagenes.length}
            </span>
          )}
        </div>
      )}

      {/* Flechas de Navegación si hay > 1 imagen */}
      {imagenes.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/70 hover:bg-amber-500 hover:text-black text-white flex items-center justify-center opacity-0 group-hover/banner:opacity-100 transition-all border border-white/20 shadow-lg z-10"
            title="Anterior foto"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/70 hover:bg-amber-500 hover:text-black text-white flex items-center justify-center opacity-0 group-hover/banner:opacity-100 transition-all border border-white/20 shadow-lg z-10"
            title="Siguiente foto"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Indicadores / Puntos inferior */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
            {imagenes.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveIndex(idx)
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  activeIndex === idx ? 'w-4 bg-amber-400' : 'bg-white/40 hover:bg-white'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
