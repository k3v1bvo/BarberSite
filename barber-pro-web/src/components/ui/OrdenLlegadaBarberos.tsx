'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBusinessDateString } from '@/lib/asistencia/helpers'

interface BarberoTurnoItem {
  id: string
  profile_id: string
  full_name: string
  avatar_url?: string
  hora_entrada: string
  lastServedTime: string | null
  turnoPosicion: number
}

export function OrdenLlegadaBarberos() {
  const [listaTurnos, setListaTurnos] = useState<BarberoTurnoItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchOrdenLlegadaYTurnos()
    const interval = setInterval(fetchOrdenLlegadaYTurnos, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchOrdenLlegadaYTurnos = async () => {
    try {
      const hoy = getBusinessDateString()

      // 1. Obtener barberos que marcaron asistencia hoy
      const { data: asistencias, error } = await supabase
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

      if (error || !asistencias) return

      // 2. Obtener citas completadas hoy para saber la última atención de cada barbero
      const { data: citasHoy } = await supabase
        .from('citas')
        .select('barbero_id, updated_at')
        .gte('fecha_hora', `${hoy}T00:00:00`)
        .lte('fecha_hora', `${hoy}T23:59:59`)
        .eq('estado', 'completado')
        .order('updated_at', { ascending: false })

      const lastServedMap = new Map<string, string>()
      if (citasHoy) {
        for (const c of citasHoy) {
          if (!lastServedMap.has(c.barbero_id)) {
            lastServedMap.set(c.barbero_id, c.updated_at)
          }
        }
      }

      // 3. Mapear los barberos llegados hoy
      const mapeados: BarberoTurnoItem[] = asistencias.map((item: any) => {
        const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return {
          id: item.id,
          profile_id: item.profile_id,
          full_name: p?.full_name || 'Barbero',
          avatar_url: p?.avatar_url,
          hora_entrada: item.hora_entrada,
          lastServedTime: lastServedMap.get(item.profile_id) || null,
          turnoPosicion: 0,
        }
      })

      // 4. Ordenar para determinar quién atiende primero (Próximo Turno)
      // - Primero: los que NO han atendido hoy (lastServedTime === null), ordenados por hora de entrada ASC
      // - Segundo: los que SÍ han atendido hoy, ordenados por lastServedTime ASC (el que atendió hace más tiempo va antes)
      mapeados.sort((a, b) => {
        if (!a.lastServedTime && !b.lastServedTime) {
          return a.hora_entrada.localeCompare(b.hora_entrada)
        }
        if (!a.lastServedTime) return -1
        if (!b.lastServedTime) return 1
        return a.lastServedTime.localeCompare(b.lastServedTime)
      })

      mapeados.forEach((m, idx) => {
        m.turnoPosicion = idx + 1
      })

      setListaTurnos(mapeados)
    } catch (err) {
      console.error('Error fetching orden llegada turnos:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-xl bg-zinc-900 border border-white/10 hover:border-emerald-500/50 text-zinc-300 hover:text-white transition-all text-xs font-bold"
        title="Ver orden de llegada y próximo turno de atención"
      >
        <span className="text-emerald-400">🏁</span>
        <span className="hidden sm:inline">Turnos / Llegada</span>
        <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
          {listaTurnos.length}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🏁</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white">
                    Orden de Turnos y Llegada
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Seguimiento visual de atención hoy
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <p className="text-center py-4 text-xs text-zinc-500 font-medium">Cargando...</p>
            ) : listaTurnos.length === 0 ? (
              <div className="text-center py-4 text-zinc-500">
                <Clock className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Ningún barbero ha marcado entrada aún hoy.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {listaTurnos.map((item, idx) => {
                  const hora = item.hora_entrada
                    ? item.hora_entrada.slice(0, 5)
                    : '--:--'
                  const esProximo = idx === 0

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex flex-col p-2.5 rounded-xl border transition-colors',
                        esProximo
                          ? 'bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30'
                          : idx === 1
                          ? 'bg-zinc-800/80 border-zinc-700'
                          : 'bg-white/5 border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10">
                            {item.avatar_url ? (
                              <img
                                src={item.avatar_url}
                                alt={item.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {item.full_name}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              Llegó a las <span className="font-mono text-zinc-300">{hora}</span>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {esProximo ? (
                            <span className="bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                              PRÓXIMO TURNO
                            </span>
                          ) : (
                            <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black font-mono px-2 py-0.5 rounded-md border border-white/5">
                              Turno #{item.turnoPosicion}
                            </span>
                          )}
                        </div>
                      </div>
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
