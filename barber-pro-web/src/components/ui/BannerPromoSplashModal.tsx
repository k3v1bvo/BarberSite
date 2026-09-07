'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Clock } from 'lucide-react'

export interface BannerPromoData {
  activo: boolean
  imagen_url: string
  titulo?: string
  descripcion?: string
  link_url?: string
  fecha_fin?: string | null
  promocion_id?: string | null
}

interface BannerPromoSplashModalProps {
  banner: BannerPromoData | null
  isOpen?: boolean
  onClose?: () => void
}

/** Formatea YYYY-MM-DD a formato amigable "30 de septiembre" */
function formatFechaFin(fechaStr: string) {
  try {
    const [y, m, d] = fechaStr.split('-')
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ]
    const mes = meses[parseInt(m, 10) - 1] || m
    return `${parseInt(d, 10)} de ${mes}`
  } catch {
    return fechaStr
  }
}

/** Comprueba si la fecha actual ya superó la fecha fin de la promoción */
export function isBannerExpired(banner: BannerPromoData | null | undefined): boolean {
  if (!banner || !banner.activo || !banner.imagen_url) return true
  if (banner.fecha_fin) {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hoy = `${y}-${m}-${day}`
    if (hoy > banner.fecha_fin) {
      return true // La promoción ya finalizó
    }
  }
  return false
}

export function BannerPromoSplashModal({
  banner,
  isOpen: controlledIsOpen,
  onClose,
}: BannerPromoSplashModalProps) {
  const [mounted, setMounted] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Determinar si debe abrirse automáticamente según vigencia de la promo
  useEffect(() => {
    if (isBannerExpired(banner)) {
      setInternalOpen(false)
      return
    }

    if (controlledIsOpen !== undefined) {
      setInternalOpen(controlledIsOpen)
      return
    }

    // Se muestra cada vez que el cliente entra mientras la promo no haya acabado
    setInternalOpen(true)
  }, [banner, controlledIsOpen])

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen

  // Bloquear scroll de la página de fondo mientras el modal esté abierto
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  const handleClose = () => {
    setInternalOpen(false)
    onClose?.()
  }

  if (!isOpen || !mounted || isBannerExpired(banner) || !banner) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      style={{ margin: 0 }}
    >
      {/* Clic en fondo para cerrar */}
      <div className="absolute inset-0 cursor-pointer" onClick={handleClose} />

      {/* Contenedor del Modal Centrado */}
      <div
        className="relative z-10 w-full max-w-[94vw] sm:max-w-md md:max-w-lg my-auto flex flex-col items-center animate-in zoom-in-95 duration-300 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Único botón de cierre: X flotante superior derecha */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 z-30 w-11 h-11 rounded-full bg-zinc-900 border-2 border-amber-500/70 flex items-center justify-center text-white hover:bg-red-600 hover:border-red-500 transition-all shadow-[0_0_25px_rgba(0,0,0,0.8)] active:scale-90 group cursor-pointer"
          aria-label="Cerrar promoción"
        >
          <X className="w-5 h-5 text-zinc-300 group-hover:text-white group-hover:rotate-90 transition-transform" />
        </button>

        {/* Tarjeta del Banner */}
        <div className="w-full rounded-3xl overflow-hidden shadow-[0_0_70px_rgba(245,158,11,0.25)] border border-amber-500/40 bg-zinc-950 flex flex-col">
          {/* Imagen destacada: si tiene link, al tocarla redirige */}
          <div className="relative bg-zinc-900/60 flex items-center justify-center max-h-[75vh] sm:max-h-[82vh] overflow-hidden">
            {banner.link_url ? (
              <a
                href={banner.link_url}
                onClick={handleClose}
                className="block w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              >
                <img
                  src={banner.imagen_url}
                  alt={banner.titulo || 'Promoción destacada'}
                  className="w-full h-auto max-h-[75vh] sm:max-h-[82vh] object-contain mx-auto"
                />
              </a>
            ) : (
              <img
                src={banner.imagen_url}
                alt={banner.titulo || 'Promoción destacada'}
                className="w-full h-auto max-h-[75vh] sm:max-h-[82vh] object-contain mx-auto"
              />
            )}
          </div>

          {/* Información: Título, vigencia y descripción SOLO si se ingresaron textos */}
          {(banner.titulo || banner.descripcion || banner.fecha_fin) && (
            <div className="p-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border-t border-white/10 text-center">
              {/* Badge de vigencia hasta que la promo acabe */}
              {banner.fecha_fin && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black mb-1.5 shadow-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Válido hasta el {formatFechaFin(banner.fecha_fin)}</span>
                </div>
              )}

              {banner.titulo && (
                <h3 className="text-white font-black text-lg sm:text-xl leading-tight flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{banner.titulo}</span>
                </h3>
              )}
              {banner.descripcion && (
                <p className="text-zinc-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-md mx-auto">
                  {banner.descripcion}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
