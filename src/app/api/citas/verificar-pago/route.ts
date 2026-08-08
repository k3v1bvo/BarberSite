import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

export async function POST(request: Request) {
  try {
    const { citaId } = await request.json()
    if (!citaId) {
      return NextResponse.json({ error: 'citaId es requerido' }, { status: 400 })
    }

    const serverDb = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await serverDb.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener rol del usuario
    const { data: profile } = await serverDb
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    // Obtener la cita con notas (donde se guarda el comprobante_url)
    const { data: cita, error: citaError } = await serverDb
      .from('citas')
      .select('id, barbero_id, cliente_id, estado, anticipo_monto, fecha_hora, notas, clientes(nombre, email), servicios(nombre)')
      .eq('id', citaId)
      .single()

    if (citaError || !cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    // Verificar si tiene permiso: Admin, Coordinador, o el Barbero asignado
    const isAllowed =
      profile.role === 'admin' || profile.role === 'coordinador' || cita.barbero_id === user.id
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para verificar este pago' },
        { status: 403 }
      )
    }

    if (cita.estado !== 'pendiente_pago') {
      return NextResponse.json(
        { error: 'La cita no está pendiente de pago' },
        { status: 400 }
      )
    }

    // Actualizar la cita
    const { error: updateError } = await serverDb
      .from('citas')
      .update({
        estado: 'confirmado',
        anticipo_verificado: true,
        anticipo_verificado_por: user.id,
        anticipo_verificado_at: new Date().toISOString(),
      })
      .eq('id', citaId)

    if (updateError) {
      console.error('[verificar-pago] Error update:', updateError)
      return NextResponse.json({ error: 'Error al verificar pago' }, { status: 500 })
    }

    // Obtener nombre del barbero
    let barberoNombre = 'Equipo'
    if (cita.barbero_id) {
      const { data: barberoProfile } = await serverDb
        .from('profiles')
        .select('full_name')
        .eq('id', cita.barbero_id)
        .single()
      barberoNombre = barberoProfile?.full_name || 'Equipo'
    }

    // Extraer comprobante_url de notas
    const notasStr = cita.notas as string | null
    const matchStandard = notasStr?.match(/\[Comprobante\]:\s*(https?:\/\/[^\s\n\r]+)/i)
    const matchAnyUrl = notasStr?.match(/(https?:\/\/[^\s\n\r]+\.(?:jpg|jpeg|png|webp|gif|svg)|https?:\/\/(?:i\.)?ibb\.co\/[^\s\n\r]+|https?:\/\/res\.cloudinary\.com\/[^\s\n\r]+)/i)
    const comprobante_url = matchStandard ? matchStandard[1].trim() : (matchAnyUrl ? matchAnyUrl[1].trim() : undefined)

    // Disparar notificaciones
    const cliente = cita.clientes as { nombre?: string; email?: string } | null
    const servicio = cita.servicios as { nombre?: string } | null
    const fh = new Date(cita.fecha_hora)

    const notifDb = getNotificationDbClient(serverDb)
    await dispatchNotification(notifDb, {
      event: 'pago_verificado',
      payload: {
        citaId,
        clienteId: cita.cliente_id,
        barberoId: cita.barbero_id,
        barberoNombre,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email ?? undefined,
        servicioNombre: servicio?.nombre,
        monto: cita.anticipo_monto,
        fecha: fh.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
        hora: fh.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' }),
        motivo: profile.full_name,
        comprobante_url,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/citas/verificar-pago]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
