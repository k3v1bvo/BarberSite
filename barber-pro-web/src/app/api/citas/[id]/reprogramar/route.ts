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
    const { newDate, newTime, durationMinutes, newBarberoId, newServicioId, notas } = body

    if (!newDate || !newTime) {
      return NextResponse.json({ error: 'Faltan datos de fecha u hora' }, { status: 400 })
    }

    const { data: oldCita, error: findError } = await adminSupabase
      .from('citas')
      .select('id, fecha_hora, barbero_id, servicio_id, precio, estado, duracion_real_minutos, notas, anticipo_monto')
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

    // Si es admin o coordinador y cambió el barbero
    if (newBarberoId && (role === 'admin' || role === 'coordinador')) {
      updatePayload.barbero_id = newBarberoId
    }

    // Si cambió el servicio
    if (newServicioId && (role === 'admin' || role === 'coordinador' || role === 'barbero')) {
      const { data: serv } = await adminSupabase
        .from('servicios')
        .select('id, nombre, precio, duracion_minutos')
        .eq('id', newServicioId)
        .maybeSingle()

      if (serv) {
        updatePayload.servicio_id = serv.id
        // Si el precio original no era 100% gratis por regalo, actualizar precio
        if (oldCita.precio > 0 || !oldCita.notas?.includes('GRATIS')) {
          updatePayload.precio = serv.precio
        }
        if (!durationMinutes) {
          updatePayload.duracion_real_minutos = serv.duracion_minutos
        }
      }
    }

    if (notas !== undefined) {
      updatePayload.notas = notas
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('citas')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        barbero:profiles!citas_barbero_id_fkey(id, full_name, email, avatar_url),
        servicio:servicios!citas_servicio_id_fkey(id, nombre, precio, duracion_minutos)
      `)
      .single()

    if (updateError) {
      console.error('Error reprogramming cita:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const huboCambios = (oldCita?.fecha_hora !== fechaHora) || (oldCita?.barbero_id !== updated.barbero_id) || (oldCita?.servicio_id !== updated.servicio_id)

    if (huboCambios) {
      try {
        const adminDb = getNotificationDbClient(supabase)
        await dispatchCitaReprogramada(adminDb, id, oldCita.fecha_hora, fechaHora, oldCita.barbero_id, updated.barbero_id)
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
