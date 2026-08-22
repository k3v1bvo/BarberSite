import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchCitaReprogramada } from '@/lib/notifications/dispatch'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role
    const puedeReprogramar = role === 'admin' || role === 'coordinador' || role === 'barbero'

    if (!puedeReprogramar) {
      return NextResponse.json({ error: 'No tienes permisos para reprogramar citas' }, { status: 403 })
    }

    const body = await request.json()
    const { newDate, newTime, durationMinutes } = body

    if (!newDate || !newTime) {
      return NextResponse.json({ error: 'Faltan datos de fecha u hora' }, { status: 400 })
    }

    const { data: oldCita, error: findError } = await adminSupabase
      .from('citas')
      .select('id, fecha_hora, barbero_id, estado, duracion_real_minutos')
      .eq('id', id)
      .maybeSingle()

    if (findError || !oldCita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    if (role === 'barbero' && oldCita.barbero_id !== user.id) {
      return NextResponse.json({ error: 'No puedes reprogramar citas de otro barbero' }, { status: 403 })
    }

    // Normalizar hora con relleno de ceros (ej. 9:00 -> 09:00)
    const timeParts = String(newTime).split(':')
    const cleanHour = (timeParts[0] || '09').trim().padStart(2, '0')
    const cleanMin = (timeParts[1] || '00').trim().padStart(2, '0')
    const cleanDate = String(newDate).trim()

    const fechaHora = `${cleanDate}T${cleanHour}:${cleanMin}:00-04:00`

    const updatePayload: Record<string, any> = {
      fecha_hora: fechaHora,
      reprogramacion_estado: null,
      fecha_hora_solicitada: null,
      updated_at: new Date().toISOString()
    }

    if (durationMinutes) {
      updatePayload.duracion_real_minutos = Number(durationMinutes)
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('citas')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error reprogramming cita:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (oldCita?.fecha_hora && oldCita.fecha_hora !== fechaHora) {
      try {
        const adminDb = getNotificationDbClient(supabase)
        await dispatchCitaReprogramada(adminDb, id, oldCita.fecha_hora, fechaHora)
      } catch (notifErr) {
        console.error('Error enviando notificación de reprogramación:', notifErr)
      }
    }

    return NextResponse.json({ success: true, message: 'Cita reprogramada exitosamente', cita: updated })
  } catch (err: any) {
    console.error('Error en /api/citas/[id]/reprogramar:', err)
    return NextResponse.json({ error: err.message || 'Error interno al reprogramar cita' }, { status: 500 })
  }
}
