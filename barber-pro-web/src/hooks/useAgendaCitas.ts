'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDateRangeForView, type AgendaView } from '@/lib/agenda/date-range'
import type { AgendaCita, AgendaResponse } from '@/lib/agenda/types'

export function useAgendaCitas(
  view: AgendaView,
  selectedDate: Date,
  barberoId?: string | null,
  enabled = true
) {
  const [citas, setCitas] = useState<AgendaCita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)
      const { fechaInicio, fechaFin } = getDateRangeForView(view, selectedDate)
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

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load, enabled])

  return { citas, loading, error, reload: load }
}
