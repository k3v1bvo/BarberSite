'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, User, RotateCw, CheckCircle2, Flame, Award, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBusinessDateString } from '@/lib/asistencia/helpers'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'

interface BarberoTurnoItem {
  id: string
  profile_id: string
  full_name: string
  avatar_url?: string
  hora_entrada: string
  lastServedTime: string | null
  totalCitasHoy: number
  turnoPosicion: number
}

export function OrdenLlegadaBarberos() {
  const [listaTurnos, setListaTurnos] = useState<BarberoTurnoItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rotationOffset, setRotationOffset] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchOrdenLlegadaYTurnos()
    fetchConfigTurnos()

    // Canal Realtime para cambios de turno/offset (ya existía)
    const channel = supabase
      .channel('config_turnos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'config_turnos', filter: 'id=eq.turno_offset' },
        (payload: any) => {
          if (payload.new && typeof payload.new.rotation_offset === 'number') {
            const hoy = getBusinessDateString()
            if (payload.new.fecha === hoy) {
              setRotationOffset(payload.new.rotation_offset)
            } else {
              setRotationOffset(0)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Realtime: cuando un barbero llega o se va, recalcular el orden al instante
  // Reemplaza el antiguo setInterval(fetchOrdenLlegadaYTurnos, 30000)
  useRealtimeTable('orden-asistencias-realtime', {
    table: 'asistencias',
    onChange: () => {
      fetchOrdenLlegadaYTurnos()
    },
  })

  const fetchConfigTurnos = async () => {
    try {
      const hoy = getBusinessDateString()
      const { data } = await supabase
        .from('config_turnos')
        .select('*')
        .eq('id', 'turno_offset')
        .maybeSingle()

      if (data) {
        if (data.fecha === hoy) {
          setRotationOffset(data.rotation_offset || 0)
        } else {
          // Es un nuevo día, reiniciar offset
          setRotationOffset(0)
          await supabase.from('config_turnos').upsert({
            id: 'turno_offset',
            fecha: hoy,
            rotation_offset: 0,
            updated_at: new Date().toISOString()
          })
        }
      }
    } catch (err) {
      console.error('Error fetching config_turnos:', err)
    }
  }

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
            avatar_url,
            role
          )
        `)
        .eq('fecha', hoy)
        .not('hora_entrada', 'is', null)
        .order('hora_entrada', { ascending: true })

      if (error || !asistencias) return

      // Normalizador de nombre para deduplicar cuentas duplicadas del mismo barbero
      const getNormalizedNameKey = (name: string): string => {
        if (!name) return ''
        const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        const parts = clean.split(/\s+/).filter(Boolean)
        return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || clean
      }

      // Filtrar solo barberos (excluir coordinadores/admins) y deduplicar por profile_id y por nombre
      const seenProfileIds = new Set<string>()
      const seenNameKeys = new Set<string>()
      const asistenciasUnicas = asistencias.filter((item: any) => {
        const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        
        // Excluir si no es rol barbero (ej: coordinador, admin)
        if (p?.role && p.role !== 'barbero') return false

        const nameKey = getNormalizedNameKey(p?.full_name || '')

        if (seenProfileIds.has(item.profile_id)) return false
        if (nameKey && seenNameKeys.has(nameKey)) return false

        seenProfileIds.add(item.profile_id)
        if (nameKey) seenNameKeys.add(nameKey)
        return true
      })

      // 2. Obtener citas completadas hoy para saber la última atención y conteo de cada barbero
      const { data: citasHoy } = await supabase
        .from('citas')
        .select('barbero_id, updated_at')
        .gte('fecha_hora', `${hoy}T00:00:00`)
        .lte('fecha_hora', `${hoy}T23:59:59`)
        .eq('estado', 'completado')
        .order('updated_at', { ascending: false })

      const lastServedMap = new Map<string, string>()
      const totalCitasMap = new Map<string, number>()
      if (citasHoy) {
        for (const c of citasHoy) {
          if (!lastServedMap.has(c.barbero_id)) {
            lastServedMap.set(c.barbero_id, c.updated_at)
          }
          totalCitasMap.set(c.barbero_id, (totalCitasMap.get(c.barbero_id) || 0) + 1)
        }
      }

      // 3. Mapear los barberos llegados hoy (ya deduplicados)
      const mapeados: BarberoTurnoItem[] = asistenciasUnicas.map((item: any) => {
        const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return {
          id: item.id,
          profile_id: item.profile_id,
          full_name: p?.full_name || 'Barbero',
          avatar_url: p?.avatar_url,
          hora_entrada: item.hora_entrada,
          lastServedTime: lastServedMap.get(item.profile_id) || null,
          totalCitasHoy: totalCitasMap.get(item.profile_id) || 0,
          turnoPosicion: 0,
        }
      })

      // 4. Orden base según llegada y última atención
      mapeados.sort((a, b) => {
        if (!a.lastServedTime && !b.lastServedTime) {
          return a.hora_entrada.localeCompare(b.hora_entrada)
        }
        if (!a.lastServedTime) return -1
        if (!b.lastServedTime) return 1
        return a.lastServedTime.localeCompare(b.lastServedTime)
      })

      setListaTurnos(mapeados)
    } catch (err) {
      console.error('Error fetching orden llegada turnos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Rotación cíclica de turnos (offset manual)
  const turnosOrdenados = [...listaTurnos]
  if (turnosOrdenados.length > 0 && rotationOffset > 0) {
    const shift = rotationOffset % turnosOrdenados.length
    const movidos = turnosOrdenados.splice(0, shift)
    turnosOrdenados.push(...movidos)
  }

  turnosOrdenados.forEach((m, idx) => {
    m.turnoPosicion = idx + 1
  })

  const pasarTurno = async () => {
    if (listaTurnos.length === 0) return
    const nextOffset = (rotationOffset + 1) % listaTurnos.length
    setRotationOffset(nextOffset)

    try {
      const hoy = getBusinessDateString()
      await supabase.from('config_turnos').upsert({
        id: 'turno_offset',
        fecha: hoy,
        rotation_offset: nextOffset,
        updated_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('Error guardando rotación de turno:', err)
    }
  }

  const proximoBarbero = turnosOrdenados[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-3 rounded-xl bg-zinc-900 border border-amber-500/40 hover:border-amber-500 text-zinc-200 hover:text-white transition-all text-xs font-bold shadow-md shadow-amber-500/5 group shrink-0 active:scale-95"
        title="Ver orden de llegada y pasar turno"
      >
        <span className="text-amber-400 group-hover:scale-110 transition-transform">🏁</span>
        <span className="font-extrabold uppercase tracking-wider text-[10px] sm:text-[11px]">Turnos</span>
        {proximoBarbero && (
          <span className="hidden md:inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-black">
            👉 {proximoBarbero.full_name.split(' ')[0]}
          </span>
        )}
        <span className="bg-amber-500 text-black font-black px-1.5 py-0.5 rounded-md text-[10px]">
          {listaTurnos.length}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  🏁
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                    Orden de Turnos <span className="text-[10px] text-amber-400 font-mono">({listaTurnos.length} activos)</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Asignación inteligente de clientes de a pie
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-amber-500">
                <Clock className="w-5 h-5 animate-spin" />
              </div>
            ) : turnosOrdenados.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 space-y-2">
                <Clock className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                <p className="text-xs font-bold">Ningún barbero ha marcado entrada aún hoy.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Botón Acción Principal: Pasar Turno */}
                <button
                  onClick={pasarTurno}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <RotateCw className="w-4 h-4 text-black animate-spin-slow" />
                  <span>Pasar Turno al Siguiente</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>

                {/* Lista de Barberos */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {turnosOrdenados.map((item, idx) => {
                    const horaEntradaFmt = item.hora_entrada
                      ? new Date(item.hora_entrada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '--:--'
                    const esProximo = idx === 0

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border transition-all',
                          esProximo
                            ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-amber-500/50 ring-1 ring-amber-500/40 shadow-md shadow-amber-500/10'
                            : idx === 1
                            ? 'bg-zinc-900/90 border-zinc-800'
                            : 'bg-zinc-900/40 border-white/5 opacity-80 hover:opacity-100'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar con badge de posición */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border-2 border-white/10 flex items-center justify-center">
                              {item.avatar_url ? (
                                <img
                                  src={item.avatar_url}
                                  alt={item.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-zinc-500" />
                              )}
                            </div>
                            <span className={cn(
                              'absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border border-black shadow',
                              esProximo ? 'bg-amber-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-300'
                            )}>
                              #{item.turnoPosicion}
                            </span>
                          </div>

                          {/* Nombre y detalles */}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-white truncate">
                                {item.full_name}
                              </p>
                              {item.totalCitasHoy > 0 && (
                                <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  {item.totalCitasHoy}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                              <span>Entrada: <strong className="text-zinc-300 font-mono">{horaEntradaFmt}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Badge de Estado / Turno */}
                        <div className="shrink-0 ml-2">
                          {esProximo ? (
                            <div className="flex flex-col items-end">
                              <span className="bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-md shadow-amber-500/30 animate-pulse flex items-center gap-1">
                                <Flame className="w-3 h-3 text-black" />
                                TOCA ATENDER
                              </span>
                              <span className="text-[8px] text-amber-400 font-bold uppercase tracking-wider mt-1">Próximo Cliente</span>
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 border border-white/5 px-2 py-1 rounded-lg">
                              En espera
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

