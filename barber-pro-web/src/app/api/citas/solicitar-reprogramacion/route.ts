import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { cita_id, nueva_fecha, nueva_hora } = await request.json()

    if (!cita_id || !nueva_fecha || !nueva_hora) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Verify cita exists and belongs to the user
    const { data: cita, error: findError } = await adminSupabase
      .from('citas')
      .select('id, cliente_id, barbero_id, clientes(id, user_id, email, nombre)')
      .eq('id', cita_id)
      .maybeSingle()

    if (findError || !cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    const clienteData = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
    const isOwner = cita.cliente_id === user.id || 
                    clienteData?.user_id === user.id || 
                    clienteData?.id === user.id || 
                    clienteData?.email?.toLowerCase() === user.email?.toLowerCase()

    if (!isOwner) {
      return NextResponse.json({ error: 'No tienes permiso para reprogramar esta cita' }, { status: 403 })
    }

    const fechaHoraSolicitada = new Date(`${nueva_fecha}T${nueva_hora}:00-04:00`).toISOString()

    const { error: updateError } = await adminSupabase
      .from('citas')
      .update({
        reprogramacion_estado: 'pendiente_aprobacion',
        fecha_hora_solicitada: fechaHoraSolicitada,
        updated_at: new Date().toISOString()
      })
      .eq('id', cita_id)

    if (updateError) {
      console.error('Error updating cita in solicitar-reprogramacion:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Notificar al barbero
    try {
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: 'reprogramacion_solicitada',
        payload: {
          citaId: cita_id,
          barberoId: cita.barbero_id,
          nuevaFecha: nueva_fecha,
          nuevaHora: nueva_hora
        }
      })
    } catch (e) {
      console.error('Error dispatching reprogramacion_solicitada notif', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API solicitar-reprogramacion:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
