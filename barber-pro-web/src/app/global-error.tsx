'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('BarberSite Root Layout Caught Error:', error)
  }, [error])

  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-white flex items-center justify-center p-4 m-0 font-sans select-none">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-950 border border-amber-500/20 p-8 rounded-3xl shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-2xl font-black">
            ✂️
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white m-0">
              BarberSite
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed m-0">
              Ocurrió un problema de conexión al cargar la app. Tus reservas están seguras.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl border-none cursor-pointer transition-all"
            >
              Reintentar
            </button>
            <button
              onClick={() => {
                window.location.href = '/'
              }}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl cursor-pointer transition-all"
            >
              Ir al Inicio
            </button>
          </div>

          {error?.digest && (
            <p className="text-[10px] text-zinc-600 font-mono tracking-wider m-0">
              ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
