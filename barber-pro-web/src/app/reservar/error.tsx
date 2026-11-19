'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, Home, Scissors, ExternalLink } from 'lucide-react'

export default function ReservarError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    console.error('[Reservar Error Boundary]:', error)
    if (typeof navigator !== 'undefined') {
      setIsAndroid(/android/i.test(navigator.userAgent || ''))
    }
  }, [error])

  const handleOpenChrome = () => {
    if (typeof window === 'undefined') return
    const currentUrl = window.location.href.replace(/^https?:\/\//, '')
    const chromeIntent = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end;`
    window.location.href = chromeIntent
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative select-none">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-6 bg-zinc-950 border border-amber-500/30 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg">
          <Scissors className="w-8 h-8 rotate-45" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white m-0">
            Pausa en la Reserva
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed m-0">
            Hubo una interrupción de conexión con el catálogo de horarios. Si estás abriendo el enlace desde Facebook o Instagram, te recomendamos abrirlo directamente en Chrome.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-black font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reintentar Carga</span>
          </button>

          {isAndroid && (
            <button
              onClick={handleOpenChrome}
              className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir en Chrome</span>
            </button>
          )}

          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold text-xs uppercase tracking-widest py-3 px-5 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ir al Inicio</span>
          </button>
        </div>

        {error?.digest && (
          <p className="text-[10px] text-zinc-600 font-mono tracking-wider pt-1 m-0">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
