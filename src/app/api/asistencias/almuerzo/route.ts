import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
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

    const db = getNotificationDbClient(supabase)
    const hoy = getBusinessDateString()

    // Verificar que tenga turno activo hoy
    const { data: asistencia } = await db
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

    const { data: almuerzoExistentes } = await db
      .from('barbero_bloqueos')
      .select('id')
      .eq('barbero_id', user.id)
      .gte('fecha_inicio', inicioDia)
      .lte('fecha_inicio', finDia)
      .ilike('motivo', '%almuerzo%')
      .order('created_at', { ascending: false })
      .limit(1)

    const almuerzoExistente = almuerzoExistentes?.[0]

    // Leer duración configurable desde configuraciones (usando maybeSingle para no fallar si no existe)
    const { data: config } = await db
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'asistencia_config')
      .maybeSingle()

    const duracionMinutos = config?.valor?.duracion_almuerzo_minutos ?? DEFAULT_LUNCH_DURATION
    const finAlmuerzo = new Date(ahora.getTime() + duracionMinutos * 60 * 1000)

    let bloqueo;
    
    if (almuerzoExistente) {
      // Si ya existe un bloque (ej. pre-programado por admin), lo actualizamos para iniciar ahora
      const { data: b, error: bError } = await db
        .from('barbero_bloqueos')
        .update({
          fecha_inicio: ahora.toISOString(),
          fecha_fin: finAlmuerzo.toISOString(),
          tipo: 'bloqueo',
          motivo: 'Pausa de almuerzo',
        })
        .eq('id', almuerzoExistente.id)
        .select()
        .maybeSingle()
        
      if (bError) throw bError
      bloqueo = b;
    } else {
      // Crear bloqueo en barbero_bloqueos (tipo 'bloqueo' cumple el check constraint de Supabase)
      const { data: b, error: bError } = await db
        .from('barbero_bloqueos')
        .insert({
          barbero_id: user.id,
          fecha_inicio: ahora.toISOString(),
          fecha_fin: finAlmuerzo.toISOString(),
          tipo: 'bloqueo',
          motivo: 'Pausa de almuerzo',
          todo_el_dia: false,
        })
        .select()
        .maybeSingle()

      if (bError) throw bError
      bloqueo = b;
    }

    // Marcar en asistencia que está en almuerzo
    await db
      .from('asistencias')
      .update({ en_almuerzo: true })
      .eq('id', asistencia.id)

    // Notificar a Admins y Coordinadores por Email y Sistema
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const barberoNombre = profile?.full_name || 'Barbero'

      const { data: admins } = await db
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['admin', 'coordinador'])

      if (admins && admins.length > 0) {
        const horaInicioStr = ahora.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })
        const horaFinStr = finAlmuerzo.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })

        // 1. Notificaciones por Sistema en Base de Datos
        const notifPayloads = admins.map(a => ({
          user_id: a.id,
          titulo: `🍽️ Salida a Almuerzo: ${barberoNombre}`,
          mensaje: `El colaborador ${barberoNombre} ha iniciado su pausa de almuerzo de ${duracionMinutos} min. Retorno estimado: ${horaFinStr}.`,
          tipo: 'asistencia',
          leido: false,
        }))

        try {
          await db.from('notificaciones').insert(notifPayloads)
        } catch {
          /* silencioso si no existe tabla */
        }

        // 2. Notificaciones por Email
        try {
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
        } catch {
          /* silencioso */
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
  } catch (err: any) {
    console.error('POST asistencias/almuerzo:', err)
    return NextResponse.json({ error: err?.message || 'Error al iniciar almuerzo' }, { status: 500 })
  }
}

/** DELETE: Regresar del almuerzo — requiere geolocalización para verificar presencia */
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Leer coordenadas del body
    let lat: number | null = null
    let lng: number | null = null

    try {
      const body = await request.json()
      lat = body.lat ?? null
      lng = body.lng ?? null
    } catch {
      // Body vacío es válido — se validará abajo si ubicación está activa
    }

    // Validar geolocalización contra la configuración del negocio
    const { data: ubicacionConfig } = await supabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'ubicacion_negocio')
      .maybeSingle()

    const ubicacion = ubicacionConfig?.valor as { lat?: number; lng?: number; radio_metros?: number; activa?: boolean } | null

    if (ubicacion?.activa) {
      if (lat == null || lng == null) {
        return NextResponse.json(
          { error: 'Debes compartir tu ubicación para marcar tu regreso del almuerzo.' },
          { status: 400 }
        )
      }

      // Haversine distance
      const R = 6371000
      const dLat = (ubicacion.lat! - lat) * Math.PI / 180
      const dLng = (ubicacion.lng! - lng) * Math.PI / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat * Math.PI / 180) * Math.cos(ubicacion.lat! * Math.PI / 180) * Math.sin(dLng / 2) ** 2
      const distancia = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const radioMax = ubicacion.radio_metros ?? 200

      if (distancia > radioMax) {
        return NextResponse.json(
          { error: `Estás fuera del rango permitido (${Math.round(distancia)}m). Debes estar a menos de ${radioMax}m de la barbería para marcar tu regreso.` },
          { status: 403 }
        )
      }
    }

    const db = getNotificationDbClient(supabase)
    const hoy = getBusinessDateString()
    const inicioDia = `${hoy}T00:00:00-04:00`
    const finDia = `${hoy}T23:59:59-04:00`

    // Buscar bloqueos de almuerzo activos de hoy
    const { data: bloqueos } = await db
      .from('barbero_bloqueos')
      .select('id')
      .eq('barbero_id', user.id)
      .gte('fecha_inicio', inicioDia)
      .lte('fecha_inicio', finDia)
      .ilike('motivo', '%almuerzo%')

    if (bloqueos && bloqueos.length > 0) {
      const ids = bloqueos.map(b => b.id)
      await db.from('barbero_bloqueos').delete().in('id', ids)
    }

    // Actualizar asistencia
    await db
      .from('asistencias')
      .update({ en_almuerzo: false })
      .eq('profile_id', user.id)
      .eq('fecha', hoy)

    return NextResponse.json({ ok: true, mensaje: 'Regresaste del almuerzo' })
  } catch (err: any) {
    console.error('DELETE asistencias/almuerzo:', err)
    return NextResponse.json({ error: err?.message || 'Error al regresar del almuerzo' }, { status: 500 })
  }
}

