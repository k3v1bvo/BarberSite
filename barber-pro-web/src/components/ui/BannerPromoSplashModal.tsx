'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Megaphone, ArrowRight, Sparkles } from 'lucide-react'

export interface BannerPromoData {
  activo: boolean
  imagen_url: string
  titulo?: string
  descripcion?: string
  link_url?: string
}

interface BannerPromoSplashModalProps {
  banner: BannerPromoData | null
  isOpen?: boolean
  onClose?: () => void
  storageKey?: string
}

export function BannerPromoSplashModal({
  banner,
  isOpen: controlledIsOpen,
  onClose,
  storageKey = 'banner_promo_dismissed',
}: BannerPromoSplashModalProps) {
  const [mounted, setMounted] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Determinar si debe abrirse automáticamente según sessionStorage si no es controlado
  useEffect(() => {
    if (!banner || !banner.activo || !banner.imagen_url) {
      setInternalOpen(false)
      return
    }

    if (controlledIsOpen !== undefined) {
      setInternalOpen(controlledIsOpen)
      return
    }

    try {
      const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
      if (!dismissed) {
        setInternalOpen(true)
      }
    } catch {
      setInternalOpen(true)
    }
  }, [banner, controlledIsOpen, storageKey])

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
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, '1')
      }
    } catch {
      // ignore
    }
    setInternalOpen(false)
    onClose?.()
  }

  if (!isOpen || !mounted || !banner || !banner.activo || !banner.imagen_url) {
    return null
  }

  const modalContent = (
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
        {/* Botón flotante superior derecho (✕) */}
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
          {/* Imagen destacada con altura máxima adaptable para móviles y desktops */}
          <div className="relative bg-zinc-900/60 flex items-center justify-center max-h-[55vh] sm:max-h-[62vh] overflow-hidden">
            {banner.link_url ? (
              <a
                href={banner.link_url}
                onClick={handleClose}
                className="block w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              >
                <img
                  src={banner.imagen_url}
                  alt={banner.titulo || 'Promoción destacada'}
                  className="w-full h-auto max-h-[55vh] sm:max-h-[62vh] object-contain mx-auto"
                />
              </a>
            ) : (
              <img
                src={banner.imagen_url}
                alt={banner.titulo || 'Promoción destacada'}
                className="w-full h-auto max-h-[55vh] sm:max-h-[62vh] object-contain mx-auto"
              />
            )}
          </div>

          {/* Información: Título, descripción y botón opcional */}
          {(banner.titulo || banner.descripcion || banner.link_url) && (
            <div className="p-4 sm:p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-t border-white/10 text-center">
              {banner.titulo && (
                <h3 className="text-white font-black text-lg sm:text-xl leading-tight flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{banner.titulo}</span>
                </h3>
              )}
              {banner.descripcion && (
                <p className="text-zinc-300 text-xs sm:text-sm mt-1.5 leading-relaxed max-w-md mx-auto">
                  {banner.descripcion}
                </p>
              )}
              {banner.link_url && (
                <a
                  href={banner.link_url}
                  onClick={handleClose}
                  className="mt-3.5 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm transition-all shadow-lg active:scale-95"
                >
                  Aprovechar Promoción <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Botón inferior amigable para continuar */}
        <button
          type="button"
          onClick={handleClose}
          className="mt-3.5 inline-flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/50 backdrop-blur-md px-5 py-2 rounded-full text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          <Megaphone className="w-3.5 h-3.5 text-amber-500" />
          <span>Continuar</span>
          <X className="w-3.5 h-3.5 text-zinc-400 ml-1" />
        </button>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
