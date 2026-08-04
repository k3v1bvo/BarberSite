import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DEFAULT_LUNCH_DURATION } from '@/lib/asistencia/constants'
import { getBusinessDateString } from '@/lib/asistencia/helpers'

/** POST: Iniciar pausa de almuerzo — crea bloqueo temporal en barbero_bloqueos */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = getBusinessDateString()

    // Verificar que tenga turno activo hoy
    const { data: asistencia } = await supabase
      .from('asistencias')
      .select('id, hora_salida, en_almuerzo')
      .eq('profile_id', user.id)
      .eq('fecha', hoy)
      .is('hora_salida', null)
      .maybeSingle()

    if (!asistencia) {
      return NextResponse.json({ error: 'No tienes un turno activo hoy' }, { status: 400 })
    }

    if (asistencia.en_almuerzo) {
      return NextResponse.json({ error: 'Ya estás en pausa de almuerzo' }, { status: 409 })
    }

    // Verificar que no haya almuerzo ya registrado hoy (prevenir duplicados)
    const ahora = new Date()
    const inicioDia = `${hoy}T00:00:00-04:00`
    const finDia = `${hoy}T23:59:59-04:00`

    const { data: almuerzoExistente } = await supabase
      .from('barbero_bloqueos')
      .select('id')
      .eq('barbero_id', user.id)
      .eq('tipo', 'almuerzo')
      .gte('fecha_inicio', inicioDia)
      .lte('fecha_inicio', finDia)
      .maybeSingle()

    if (almuerzoExistente) {
      return NextResponse.json({ error: 'Ya tomaste tu pausa de almuerzo hoy' }, { status: 409 })
    }

    // Leer duración configurable desde configuraciones
    const { data: config } = await supabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'asistencia_config')
      .single()

    const duracionMinutos = config?.valor?.duracion_almuerzo_minutos ?? DEFAULT_LUNCH_DURATION

    const finAlmuerzo = new Date(ahora.getTime() + duracionMinutos * 60 * 1000)

    // Crear bloqueo en barbero_bloqueos (el sistema de reservas ya lee esta tabla)
    const { data: bloqueo, error: bloqueoError } = await supabase
      .from('barbero_bloqueos')
      .insert({
        barbero_id: user.id,
        fecha_inicio: ahora.toISOString(),
        fecha_fin: finAlmuerzo.toISOString(),
        tipo: 'almuerzo',
        motivo: 'Pausa de almuerzo',
        todo_el_dia: false,
      })
      .select()
      .single()

    if (bloqueoError) throw bloqueoError

    // Marcar en asistencia que está en almuerzo
    await supabase
      .from('asistencias')
      .update({ en_almuerzo: true })
      .eq('id', asistencia.id)

    // Notificar a Admins y Coordinadores por Email y Sistema
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const barberoNombre = profile?.full_name || 'Barbero'

      const { data: admins } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['admin', 'coordinador'])

      if (admins && admins.length > 0) {
        const horaInicioStr = ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
        const horaFinStr = finAlmuerzo.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

        // 1. Notificaciones por Sistema en Base de Datos
        const notifPayloads = admins.map(a => ({
          usuario_id: a.id,
          titulo: `🍽️ Salida a Almuerzo: ${barberoNombre}`,
          mensaje: `El colaborador ${barberoNombre} ha iniciado su pausa de almuerzo de ${duracionMinutos} min. Retorno estimado: ${horaFinStr}.`,
          tipo: 'asistencia',
          leido: false,
        }))

        try {
          await supabase.from('notificaciones').insert(notifPayloads)
        } catch {
          /* silencioso si no existe tabla */
        }

        // 2. Notificaciones por Email
        const { sendEmail } = await import('@/lib/notifications/email')
        for (const admin of admins) {
          if (admin.email) {
            sendEmail({
              to: admin.email,
              subject: `🍽️ Inicio de Almuerzo: ${barberoNombre}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #18181b; color: #ffffff; border-radius: 12px;">
                  <h2 style="color: #f59e0b; margin-top: 0;">🍽️ Pausa de Almuerzo Iniciada</h2>
                  <p>El colaborador <strong>${barberoNombre}</strong> ha registrado su salida a almorzar de <strong>${duracionMinutos} minutos</strong>.</p>
                  <div style="background-color: #27272a; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong>⏰ Hora de inicio:</strong> ${horaInicioStr}</p>
                    <p style="margin: 5px 0;"><strong>⏳ Retorno estimado:</strong> ${horaFinStr}</p>
                  </div>
                  <p style="font-size: 11px; color: #a1a1aa;">Notificación automática del control de asistencia de BarberSite.</p>
                </div>
              `
            }).catch(() => {})
          }
        }
      }
    } catch (e) {
      console.error('Error enviando notificaciones de almuerzo:', e)
    }

    return NextResponse.json({
      bloqueo,
      fin_almuerzo: finAlmuerzo.toISOString(),
      duracion_minutos: duracionMinutos,
    })
  } catch (err) {
    console.error('POST asistencias/almuerzo:', err)
    return NextResponse.json({ error: 'Error interno al iniciar almuerzo' }, { status: 500 })
  }
}

/** DELETE: Regresar del almuerzo antes de tiempo — elimina bloqueo y reactiva barbero */
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = getBusinessDateString()
    const inicioDia = `${hoy}T00:00:00-04:00`
    const finDia = `${hoy}T23:59:59-04:00`

    // Buscar bloqueo de almuerzo activo de hoy
    const { data: bloqueo } = await supabase
      .from('barbero_bloqueos')
      .select('id')
      .eq('barbero_id', user.id)
      .eq('tipo', 'almuerzo')
      .gte('fecha_inicio', inicioDia)
      .lte('fecha_inicio', finDia)
      .maybeSingle()

    if (bloqueo) {
      await supabase.from('barbero_bloqueos').delete().eq('id', bloqueo.id)
    }

    // Actualizar asistencia
    await supabase
      .from('asistencias')
      .update({ en_almuerzo: false })
      .eq('profile_id', user.id)
      .eq('fecha', hoy)

    return NextResponse.json({ ok: true, mensaje: '¡Bienvenido de vuelta!' })
  } catch (err) {
    console.error('DELETE asistencias/almuerzo:', err)
    return NextResponse.json({ error: 'Error interno al regresar del almuerzo' }, { status: 500 })
  }
}
