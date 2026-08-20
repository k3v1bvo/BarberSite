import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only barbero (or admin/coordinador acting as barbero) can respond
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['barbero', 'admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { citaId, respuesta } = await request.json()

    if (!citaId || !['aceptar', 'rechazar'].includes(respuesta)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { data: cita, error: findError } = await supabase
      .from('citas')
      .select('*, clientes(email, user_id, nombre)')
      .eq('id', citaId)
      .single()

    if (findError || !cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    if (profile.role === 'barbero' && cita.barbero_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let updateData: any = {
      reprogramacion_estado: respuesta === 'aceptar' ? 'aceptada' : 'rechazada'
    }

    if (respuesta === 'aceptar' && cita.fecha_hora_solicitada) {
      updateData.fecha_hora = cita.fecha_hora_solicitada
    }

    const { error: updateError } = await supabase
      .from('citas')
      .update(updateData)
      .eq('id', citaId)

    if (updateError) {
      throw updateError
    }

    // Notificar al cliente
    try {
      const clienteData = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
      
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: respuesta === 'aceptar' ? 'reprogramacion_aceptada' : 'reprogramacion_rechazada',
        payload: {
          citaId: citaId,
          clienteId: clienteData?.user_id || cita.cliente_id,
          clienteEmail: clienteData?.email,
          clienteNombre: clienteData?.nombre,
          fechaOriginal: cita.fecha_hora,
          nuevaFecha: cita.fecha_hora_solicitada
        }
      })
    } catch (e) {
      console.error('Error dispatching reprogramacion response notif', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API responder-reprogramacion:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
