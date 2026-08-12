import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inducciones/progreso — Obtener progreso global o individual
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: progreso, error } = await supabase
      .from('induccion_progreso')
      .select('*')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(progreso || [])
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/inducciones/progreso — Marcar como visto / completado o toggle
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { induccion_id, completado } = body

    if (!induccion_id) {
      return NextResponse.json({ error: 'induccion_id requerido' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    const barberoId = profile?.id || user.id

    if (completado === false) {
      // Desmarcar
      await supabase
        .from('induccion_progreso')
        .delete()
        .eq('induccion_id', induccion_id)
        .eq('barbero_id', barberoId)

      return NextResponse.json({ success: true, estado: 'pendiente' })
    } else {
      // Marcar completado
      const { data, error } = await supabase
        .from('induccion_progreso')
        .upsert({
          induccion_id,
          barbero_id: barberoId,
          estado: 'completado',
          fecha_completado: new Date().toISOString()
        }, { onConflict: 'induccion_id,barbero_id' })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, estado: 'completado' })
    }
  } catch (err: any) {
    console.error('Error POST inducciones/progreso:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
