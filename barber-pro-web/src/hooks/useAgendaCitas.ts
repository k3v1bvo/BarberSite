'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDateRangeForView, type AgendaView } from '@/lib/agenda/date-range'
import type { AgendaCita, AgendaResponse } from '@/lib/agenda/types'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'

export function useAgendaCitas(
  view: AgendaView,
  selectedDate: Date,
  barberoId?: string | null,
  enabled = true
) {
  const [citas, setCitas] = useState<AgendaCita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guardar el rango visible para poder filtrar inserciones de Realtime
  const [rangoVisible, setRangoVisible] = useState<{ inicio: string; fin: string } | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)
      const { fechaInicio, fechaFin } = getDateRangeForView(view, selectedDate)
      setRangoVisible({ inicio: fechaInicio, fin: fechaFin })

      const params = new URLSearchParams({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      })
      if (barberoId) params.set('barbero_id', barberoId)

      const response = await fetch(`/api/citas/agenda?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Error al cargar citas')
      }

      const data: AgendaResponse = await response.json()
      setCitas(data.citas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar citas')
      setCitas([])
    } finally {
      setLoading(false)
    }
  }, [view, selectedDate, barberoId, enabled])

  // Carga inicial al montar o cuando cambia la vista/fecha/barbero
  useEffect(() => {
    load()
  }, [load])

  // ─── Realtime: escuchar cambios en la tabla `citas` ───────────────────────
  // Reemplaza el antiguo setInterval(load, 30_000).
  // Solo se actualiza el registro puntual que cambió, sin recargar todo.
  useRealtimeTable<Record<string, unknown>>('agenda-citas-realtime', {
    table: 'citas',
    enabled,

    onUpdate: (updated) => {
      // Si el barbero filtrado no coincide, ignorar
      if (barberoId && updated.barbero_id !== barberoId) return
      setCitas(prev =>
        prev.map(c => c.id === (updated.id as string) ? { ...c, ...updated } as AgendaCita : c)
      )
    },

    onInsert: (nueva) => {
      // Solo agregar si cae dentro del rango de fechas actualmente visible
      if (barberoId && nueva.barbero_id !== barberoId) return
      const fechaHora = nueva.fecha_hora as string | undefined
      if (!fechaHora || !rangoVisible) return
      if (fechaHora >= rangoVisible.inicio && fechaHora <= rangoVisible.fin) {
        setCitas(prev => {
          // Evitar duplicados
          if (prev.some(c => c.id === (nueva.id as string))) return prev
          return [...prev, nueva as unknown as AgendaCita]
        })
      }
    },

    onDelete: (vieja) => {
      if (!vieja.id) return
      setCitas(prev => prev.filter(c => c.id !== (vieja.id as string)))
    },
  })

  return { citas, loading, error, reload: load }
}
