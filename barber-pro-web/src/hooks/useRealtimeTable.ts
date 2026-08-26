'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeTableOptions<T extends Record<string, unknown>> {
  /** Nombre de la tabla de Supabase a escuchar */
  table: string
  /** Filtro opcional tipo PostgREST, ej: "barbero_id=eq.uuid-123" */
  filter?: string
  /** Evento a escuchar (default: todos) */
  event?: ChangeEvent
  /** Callback cuando se inserta una nueva fila */
  onInsert?: (row: T) => void
  /** Callback cuando se actualiza una fila */
  onUpdate?: (row: T) => void
  /** Callback cuando se elimina una fila */
  onDelete?: (oldRow: Partial<T>) => void
  /** Callback genérico para cualquier cambio (recibe el payload completo) */
  onChange?: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow: T | null, oldRow: Partial<T> | null) => void
  /** Si false, no suscribir (útil para condicionar por auth o permisos) */
  enabled?: boolean
}

/**
 * Hook central de Supabase Realtime.
 * 
 * Abre un WebSocket hacia la tabla indicada y llama a los callbacks
 * cuando suceden cambios (INSERT, UPDATE, DELETE).
 * 
 * - Hace cleanup automático al desmontar el componente.
 * - Supabase maneja la reconexión automáticamente si cae el WebSocket.
 * - No hace ninguna petición HTTP periódica — 0 polling.
 * 
 * @param channelName - Nombre único del canal (ej: "agenda-citas-realtime")
 * @param options - Configuración de tabla, filtros y callbacks
 * 
 * @example
 * useRealtimeTable('citas-live', {
 *   table: 'citas',
 *   onUpdate: (cita) => setCitas(prev => prev.map(c => c.id === cita.id ? cita : c)),
 *   onInsert: (cita) => setCitas(prev => [cita, ...prev]),
 *   onDelete: (old) => setCitas(prev => prev.filter(c => c.id !== old.id)),
 * })
 */
export function useRealtimeTable<T extends Record<string, unknown>>(
  channelName: string,
  options: UseRealtimeTableOptions<T>
) {
  const {
    table,
    filter,
    event = '*',
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    enabled = true,
  } = options

  // Usamos refs para los callbacks para evitar recrear el canal si cambian
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onInsertRef.current = onInsert }, [onInsert])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()

    const filterConfig: Record<string, unknown> = {
      event,
      schema: 'public',
      table,
    }
    if (filter) filterConfig.filter = filter

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = supabase.channel(channelName).on('postgres_changes' as any, filterConfig, (payload: any) => {
      const { eventType, new: newRow, old: oldRow } = payload

      onChangeRef.current?.(eventType, newRow ?? null, oldRow ?? null)

      if (eventType === 'INSERT') onInsertRef.current?.(newRow as T)
      if (eventType === 'UPDATE') onUpdateRef.current?.(newRow as T)
      if (eventType === 'DELETE') onDeleteRef.current?.(oldRow as Partial<T>)
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // Solo se recrea el canal si cambia el channelName, la tabla, el filtro o el evento
    // Los callbacks usan refs para no forzar recreación
  }, [channelName, table, filter, event, enabled])
}
