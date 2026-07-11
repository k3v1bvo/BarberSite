'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Clock, Award, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AsistenciaBarbero {
  id: string
  hora_entrada: string
  profile_id: string
  profiles: {
    full_name: string
    avatar_url?: string
  }
}

export function OrdenLlegadaBarberos() {
  const [llegadas, setLlegadas] = useState<AsistenciaBarbero[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchOrdenLlegada()
    // Refrescar cada 2 minutos
    const interval = setInterval(fetchOrdenLlegada, 120000)
    return () => clearInterval(interval)
  }, [])

  const fetchOrdenLlegada = async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('asistencias')
        .select(`
          id,
          hora_entrada,
          profile_id,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('fecha', hoy)
        .not('hora_entrada', 'is', null)
        .order('hora_entrada', { ascending: true })

      if (!error && data) {
        setLlegadas(data as unknown as AsistenciaBarbero[])
      }
    } catch (err) {
      console.error('Error fetching orden llegada:', err)
    } finally {
      setLoading(false)
    }
  }

  const getMedalla = (pos: number) => {
    switch (pos) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return `#${pos + 1}`
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-xl bg-zinc-900 border border-white/10 hover:border-amber-500/50 text-zinc-300 hover:text-white transition-all text-xs font-bold"
        title="Orden de llegada de barberos hoy"
      >
        <span className="text-amber-400">🏁</span>
        <span className="hidden sm:inline">Orden de Llegada</span>
        <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
          {llegadas.length}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🏁</span>
                <span className="text-xs font-black uppercase tracking-widest text-white">
                  Orden de Llegada Hoy
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">
                Marcación
              </span>
            </div>

            {loading ? (
              <p className="text-center py-4 text-xs text-zinc-500 font-medium">Cargando...</p>
            ) : llegadas.length === 0 ? (
              <div className="text-center py-4 text-zinc-500">
                <Clock className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Ningún barbero ha marcado entrada aún hoy.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {llegadas.map((item, idx) => {
                  const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
                  const hora = item.hora_entrada
                    ? item.hora_entrada.slice(0, 5)
                    : '--:--'
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl border transition-colors',
                        idx === 0
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : idx === 1
                          ? 'bg-zinc-800/80 border-zinc-700'
                          : idx === 2
                          ? 'bg-amber-900/10 border-amber-800/20'
                          : 'bg-white/5 border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-black w-6 text-center shrink-0">
                          {getMedalla(idx)}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {p?.full_name || 'Barbero'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-black text-amber-400 shrink-0 bg-black/30 px-2 py-0.5 rounded-md">
                        {hora}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
