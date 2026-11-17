'use client'

import { useEffect } from 'react'
import { RotateCcw, Home, Scissors, AlertTriangle } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registrar error silenciosamente para análisis
    console.error('BarberSite App Runtime Caught Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Glow ambiental de fondo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-6 bg-zinc-950/80 border border-amber-500/20 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        {/* Ícono de Barbería */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
          <Scissors className="w-10 h-10 rotate-45" />
        </div>

        {/* Título & Mensaje */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Pausa Técnica</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Un momento, por favor
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Ocurrió una interrupción inesperada al cargar la pantalla. No te preocupes, tus citas y datos están completamente a salvo.
          </p>
        </div>

        {/* Acciones de recuperación */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>

          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-white font-bold text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ir al Inicio</span>
          </button>
        </div>

        {/* Digest de soporte opcional */}
        {error?.digest && (
          <p className="text-[10px] text-zinc-600 font-mono tracking-wider pt-2">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
