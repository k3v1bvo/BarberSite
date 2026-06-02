import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { cita_id } = body

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

    const puedeIniciar = profile?.role === 'admin' || 
                         profile?.role === 'recepcionista' ||
                         (profile?.role === 'barbero' && cita.barbero_id === user.id)

    if (!puedeIniciar) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cita.estado !== 'pendiente' && cita.estado !== 'confirmado') {
      return NextResponse.json({ error: 'La cita no puede iniciarse' }, { status: 400 })
    }

    const { error } = await supabase
      .from('citas')
      .update({ 
        estado: 'en_proceso',
        started_at: new Date().toISOString()
      })
      .eq('id', cita_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al iniciar servicio' }, { status: 500 })
  }
}