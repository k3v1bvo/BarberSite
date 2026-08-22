import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/permisos/[id]
 * Permite a administradores y coordinadores Aprobar o Rechazar una solicitud de permiso.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Solo administradores o coordinadores pueden aprobar o rechazar permisos' }, { status: 403 })
    }

    const { id: permisoId } = await context.params
    const body = await request.json()
    const { accion, motivo_rechazo } = body

    if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'Acción inválida. Debe ser "aprobar" o "rechazar"' }, { status: 400 })
    }

    const adminDb = getNotificationDbClient(supabase)
    const revisorNombre = profile.full_name || (profile.role === 'admin' ? 'Administrador' : 'Coordinador')
    const nowIso = new Date().toISOString()

    let solicitud: any = null

    // 1. Obtener la solicitud actual
    const { data: solData, error: solErr } = await adminDb
      .from('solicitudes_permisos')
      .select(`
        *,
        barbero:profiles!solicitudes_permisos_barbero_id_fkey (
          id, full_name, email, phone, avatar_url
        )
      `)
      .eq('id', permisoId)
      .single()

    if (solErr || !solData) {
      // Intentar en fallback de configuraciones
      const { data: cfg } = await adminDb
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'solicitudes_permisos_data')
        .single()

      let list: any[] = []
      if (cfg?.valor) {
        try {
          list = typeof cfg.valor === 'string' ? JSON.parse(cfg.valor) : cfg.valor
        } catch {
          list = []
        }
      }

      const idx = list.findIndex(item => item.id === permisoId)
      if (idx !== -1) {
        solicitud = list[idx]
        solicitud.estado = accion === 'aprobar' ? 'aprobado' : 'rechazado'
        solicitud.revisado_por = revisorNombre
        solicitud.revisado_por_id = user.id
        solicitud.revisado_at = nowIso
        if (accion === 'rechazar') {
          solicitud.motivo_rechazo = motivo_rechazo || 'Rechazado por la administración'
        }
        list[idx] = solicitud

        await adminDb
          .from('configuraciones')
          .upsert({
            llave: 'solicitudes_permisos_data',
            valor: JSON.stringify(list),
          }, { onConflict: 'llave' })
      } else {
        return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
      }
    } else {
      solicitud = solData

      // Actualizar en base de datos nativa
      const updatePayload: any = {
        estado: accion === 'aprobar' ? 'aprobado' : 'rechazado',
        revisado_por: revisorNombre,
        revisado_por_id: user.id,
        revisado_at: nowIso,
        updated_at: nowIso,
      }

      if (accion === 'rechazar') {
        updatePayload.motivo_rechazo = motivo_rechazo || 'Rechazado por la administración'
      }

      const { data: updatedDb, error: upErr } = await adminDb
        .from('solicitudes_permisos')
        .update(updatePayload)
        .eq('id', permisoId)
        .select(`
          *,
          barbero:profiles!solicitudes_permisos_barbero_id_fkey (
            id, full_name, email, phone, avatar_url
          )
        `)
        .single()

      if (upErr) {
        console.error('Error actualizando solicitud de permiso:', upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }
      solicitud = updatedDb
    }

    const barberoId = solicitud.barbero_id
    const barberoNombre = solicitud.barbero?.full_name || 'Barbero'
    const barberoEmail = solicitud.barbero?.email

    // 2. Si es APROBADO -> Registrar asistencia justificada y limpiar sanciones
    if (accion === 'aprobar') {
      const tipoLabel = 
        solicitud.tipo_permiso === 'jornada_completa' ? 'Jornada Completa' :
        solicitud.tipo_permiso === 'horas' ? `Horas (${solicitud.hora_inicio || '09:00'} a ${solicitud.hora_fin || '20:00'})` :
        solicitud.tipo_permiso === 'medico' ? 'Cita Médica / Reposo' :
        solicitud.tipo_permiso === 'emergencia' ? 'Salida de Emergencia' :
        solicitud.tipo_permiso === 'enfermedad_grave' ? 'Salud / Reposo' :
        solicitud.tipo_permiso === 'personal' ? 'Asunto Personal' : 'Permiso General'

      const notaAsistencia = `PERMISO JUSTIFICADO [${tipoLabel}] (Aprobado por ${revisorNombre}): ${solicitud.motivo || ''} ${solicitud.comprobante_url ? `[PDF](${solicitud.comprobante_url})` : ''}`.trim()

      // Registrar o actualizar en asistencias
      const { data: existingAsis } = await adminDb
        .from('asistencias')
        .select('id')
        .eq('profile_id', barberoId)
        .eq('fecha', solicitud.fecha)
        .maybeSingle()

      if (existingAsis?.id) {
        await adminDb
          .from('asistencias')
          .update({
            estado: 'permiso',
            notas: notaAsistencia,
            selfie_url: solicitud.comprobante_url || null,
            editado_admin: true,
          })
          .eq('id', existingAsis.id)
      } else {
        await adminDb
          .from('asistencias')
          .insert({
            profile_id: barberoId,
            fecha: solicitud.fecha,
            hora_entrada: `${solicitud.fecha}T09:00:00-04:00`,
            hora_salida: `${solicitud.fecha}T21:00:00-04:00`,
            horas_trabajadas: 0,
            estado: 'permiso',
            notas: notaAsistencia,
            selfie_url: solicitud.comprobante_url || null,
            editado_admin: true,
            cierre_automatico: false,
          })
      }

      // Eliminar sanciones si existían para esa fecha
      await adminDb.from('sanciones').delete().eq('barbero_id', barberoId).eq('fecha', solicitud.fecha)

      // ── Disparar Notificación de APROBACIÓN al Barbero ──
      await dispatchNotification(adminDb, {
        event: 'permiso_aprobado',
        payload: {
          permisoId,
          barberoId,
          barberoNombre,
          barberoEmail,
          fecha: solicitud.fecha,
          fechaFin: solicitud.fecha_fin || undefined,
          horaInicio: solicitud.hora_inicio || undefined,
          horaFin: solicitud.hora_fin || undefined,
          todo_el_dia: solicitud.todo_el_dia ? 1 : 0,
          tipoPermiso: tipoLabel,
          revisadoPor: revisorNombre,
        },
      })
    } else {
      // ── Disparar Notificación de RECHAZO al Barbero ──
      await dispatchNotification(adminDb, {
        event: 'permiso_rechazado',
        payload: {
          permisoId,
          barberoId,
          barberoNombre,
          barberoEmail,
          fecha: solicitud.fecha,
          fechaFin: solicitud.fecha_fin || undefined,
          horaInicio: solicitud.hora_inicio || undefined,
          horaFin: solicitud.hora_fin || undefined,
          todo_el_dia: solicitud.todo_el_dia ? 1 : 0,
          motivoRechazo: motivo_rechazo || 'No especificado por la administración',
          revisadoPor: revisorNombre,
        },
      })
    }

    return NextResponse.json({
      success: true,
      solicitud,
      message: accion === 'aprobar' ? 'Permiso aprobado exitosamente y notificado al barbero.' : 'Permiso rechazado y notificado al barbero.',
    })
  } catch (err: any) {
    console.error('PATCH /api/permisos/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/permisos/[id]
 * Permite al barbero cancelar su solicitud pendiente, o a un admin eliminarla.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: permisoId } = await context.params
    const adminDb = getNotificationDbClient(supabase)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminOrCoord = ['admin', 'coordinador'].includes(profile?.role || '')

    // Eliminar de tabla nativa
    const query = adminDb.from('solicitudes_permisos').delete().eq('id', permisoId)
    if (!isAdminOrCoord) {
      query.eq('barbero_id', user.id).eq('estado', 'pendiente')
    }

    const { error } = await query

    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      // Fallback
      const { data: cfg } = await adminDb
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'solicitudes_permisos_data')
        .single()

      let list: any[] = []
      if (cfg?.valor) {
        try {
          list = typeof cfg.valor === 'string' ? JSON.parse(cfg.valor) : cfg.valor
        } catch {
          list = []
        }
      }

      const filtered = list.filter(item => {
        if (item.id !== permisoId) return true
        if (isAdminOrCoord) return false
        return item.barbero_id !== user.id
      })

      await adminDb
        .from('configuraciones')
        .upsert({
          llave: 'solicitudes_permisos_data',
          valor: JSON.stringify(filtered),
        }, { onConflict: 'llave' })
    }

    return NextResponse.json({ success: true, message: 'Solicitud eliminada' })
  } catch (err: any) {
    console.error('DELETE /api/permisos/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
