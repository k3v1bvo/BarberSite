import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchCitaReprogramada } from '@/lib/notifications/dispatch'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { newDate, newTime, durationMinutes } = body

    if (!newDate || !newTime || !durationMinutes) {
      return NextResponse.json({ error: 'Faltan datos de fecha/hora' }, { status: 400 })
    }

    const { data: oldCita } = await supabase
      .from('citas')
      .select('fecha_hora')
      .eq('id', id)
      .single()

    const fechaHora = `${newDate}T${newTime}:00-04:00`
    
    // Calculate new hora_fin
    const d = new Date(fechaHora)
    d.setMinutes(d.getMinutes() + Number(durationMinutes))
    const horaFin = d.toISOString()

    const { data: updated, error } = await supabase
      .from('citas')
      .update({ 
        fecha_hora: fechaHora, 
        hora_fin: horaFin,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error reprogramming cita:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (oldCita?.fecha_hora && oldCita.fecha_hora !== fechaHora) {
      try {
        const adminDb = getNotificationDbClient(supabase)
        await dispatchCitaReprogramada(adminDb, id, oldCita.fecha_hora, fechaHora)
      } catch (notifErr) {
        console.error('Error enviando notificación de reprogramación:', notifErr)
      }
    }

    return NextResponse.json({ message: 'Cita reprogramada', cita: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

