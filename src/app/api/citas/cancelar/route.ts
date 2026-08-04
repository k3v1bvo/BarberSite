import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchCitaCancelada } from '@/lib/notifications/dispatch'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { cita_id, motivo } = body

    const { data: cita } = await supabase
      .from('citas')
      .select('barbero_id, estado')
      .eq('id', cita_id)
      .single()

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const puedeCancelar = profile?.role === 'admin' || 
                          profile?.role === 'coordinador' ||
                          (profile?.role === 'barbero' && cita.barbero_id === user.id)

    if (!puedeCancelar) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cita.estado === 'completado') {
      return NextResponse.json({ error: 'No se puede cancelar una cita completada' }, { status: 400 })
    }

    const { error } = await supabase
      .from('citas')
      .update({ estado: 'cancelado' })
      .eq('id', cita_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const db = getNotificationDbClient(supabase)
    await dispatchCitaCancelada(db, cita_id, motivo)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al cancelar cita' }, { status: 500 })
  }
}