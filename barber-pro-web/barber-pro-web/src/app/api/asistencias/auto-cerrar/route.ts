import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  computeEstadoFromRecord,
  getAutoCloseTimestamp,
  getBusinessDateString,
  isAfterAutoCloseHour,
} from '@/lib/asistencia/helpers'

/** Cierra turnos abiertos del día cuando ya pasaron las 22:00 (hora del negocio) */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = getBusinessDateString()
    const esDespuesDeCierreHoy = isAfterAutoCloseHour()

    // 1. Obtener asistencias pendientes de días anteriores O del día de hoy si ya pasaron las 22:00
    let query = supabase
      .from('asistencias')
      .select('id, fecha, hora_entrada, hora_salida, estado')
      .is('hora_salida', null)

    if (esDespuesDeCierreHoy) {
      query = query.lte('fecha', hoy)
    } else {
      query = query.lt('fecha', hoy)
    }

    const { data: abiertos, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let cerrados = 0

    for (const reg of abiertos || []) {
      const fechaReg = reg.fecha || hoy
      const cierreTs = getAutoCloseTimestamp(fechaReg)
      const entrada = new Date(reg.hora_entrada)
      const salida = new Date(cierreTs)
      const horas = Math.max(0, (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60))

      const { error: upErr } = await supabase
        .from('asistencias')
        .update({
          hora_salida: cierreTs,
          horas_trabajadas: Number(horas.toFixed(2)),
          estado: 'finalizado',
          cierre_automatico: true,
        })
        .eq('id', reg.id)

      if (!upErr) cerrados++
    }

    if (cerrados > 0) {
      const { getNotificationDbClient } = await import('@/lib/supabase/admin')
      const { dispatchNotification } = await import('@/lib/notifications/dispatch')
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: 'sistema',
        payload: {
          motivo: `Se cerraron ${cerrados} turno(s) automáticamente a las 22:00 por falta de marca de salida.`,
          link: '/admin/asistencia',
        },
      })
    }

    return NextResponse.json({
      cerrados,
      mensaje:
        cerrados > 0
          ? `${cerrados} turno(s) cerrado(s) automáticamente`
          : 'No había turnos pendientes para cerrar',
    })
  } catch (err) {
    console.error('auto-cerrar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
