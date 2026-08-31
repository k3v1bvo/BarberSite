import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification, dispatchCitaReprogramada } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only barbero (or admin/coordinador) can respond
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['barbero', 'admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { citaId, respuesta } = await request.json()

    if (!citaId || !['aceptar', 'rechazar'].includes(respuesta)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { data: cita, error: findError } = await adminSupabase
      .from('citas')
      .select('*, clientes(id, email, user_id, nombre), servicios(nombre)')
      .eq('id', citaId)
      .maybeSingle()

    if (findError || !cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    if (profile.role === 'barbero' && cita.barbero_id !== user.id) {
      return NextResponse.json({ error: 'No puedes modificar citas de otro barbero' }, { status: 403 })
    }

    const fechaOriginal = cita.fecha_hora
    const nuevaFechaHora = cita.fecha_hora_solicitada || cita.fecha_hora

    const updateData: Record<string, any> = {
      reprogramacion_estado: respuesta === 'aceptar' ? 'aceptada' : 'rechazada',
      updated_at: new Date().toISOString()
    }

    if (respuesta === 'aceptar' && cita.fecha_hora_solicitada) {
      updateData.fecha_hora = cita.fecha_hora_solicitada
      updateData.fecha_hora_solicitada = null
    } else if (respuesta === 'rechazar') {
      updateData.fecha_hora_solicitada = null
    }

    const { data: updatedCita, error: updateError } = await adminSupabase
      .from('citas')
      .update(updateData)
      .eq('id', citaId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating cita in responder-reprogramacion:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Notificar al cliente
    try {
      const clienteData = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
      const db = getNotificationDbClient(supabase)
      
      await dispatchNotification(db, {
        event: respuesta === 'aceptar' ? 'reprogramacion_aceptada' : 'reprogramacion_rechazada',
        payload: {
          citaId: citaId,
          clienteId: clienteData?.user_id || clienteData?.id || cita.cliente_id,
          clienteEmail: clienteData?.email,
          clienteNombre: clienteData?.nombre,
          fechaOriginal: fechaOriginal,
          nuevaFecha: nuevaFechaHora
        }
      })

      if (respuesta === 'aceptar' && cita.fecha_hora_solicitada) {
        await dispatchCitaReprogramada(
          db,
          citaId,
          fechaOriginal,
          cita.fecha_hora_solicitada,
          cita.barbero_id,
          cita.barbero_id
        )
      }
    } catch (e) {
      console.error('Error dispatching reprogramacion response notif', e)
    }

    return NextResponse.json({ success: true, cita: updatedCita })
  } catch (error: any) {
    console.error('API responder-reprogramacion:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
