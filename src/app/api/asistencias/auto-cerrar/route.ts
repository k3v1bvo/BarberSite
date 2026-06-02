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

    if (!isAfterAutoCloseHour()) {
      return NextResponse.json({ cerrados: 0, mensaje: 'Aún no es hora de cierre automático' })
    }

    const hoy = getBusinessDateString()

    const { data: abiertos, error } = await supabase
      .from('asistencias')
      .select('id, hora_entrada, hora_salida, estado')
      .eq('fecha', hoy)
      .is('hora_salida', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let cerrados = 0
    const cierreTs = getAutoCloseTimestamp(hoy)

    for (const reg of abiertos || []) {
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
          ? `${cerrados} turno(s) cerrado(s) automáticamente a las 22:00`
          : 'No había turnos abiertos para cerrar',
    })
  } catch (err) {
    console.error('auto-cerrar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
