import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { barbero_id, plantilla_id, dias } = body

    if (!barbero_id || !plantilla_id || !dias || !Array.isArray(dias)) {
      return NextResponse.json({ error: 'Faltan datos requeridos o formato inválido' }, { status: 400 })
    }

    const adminSupabase = await createServerAdminClient()

    // Get the template details
    const { data: plantilla, error: plantillaError } = await adminSupabase
      .from('plantillas_horario')
      .select('*')
      .eq('id', plantilla_id)
      .single()

    if (plantillaError || !plantilla) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    }

    for (const dia of dias) {
      const payloadBase = {
        barbero_id,
        dia_semana: Number(dia),
        hora_inicio: (plantilla.hora_inicio || '09:00').slice(0, 5),
        hora_fin: (plantilla.hora_fin || '20:00').slice(0, 5),
        activo: true,
        tipo_horario: plantilla.tipo || 'personalizado',
        plantilla_id
      }
      await adminSupabase.from('barbero_horario_semanal').upsert(payloadBase, { onConflict: 'barbero_id,dia_semana' })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[horarios/asignar POST] Error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
