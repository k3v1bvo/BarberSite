import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inducciones/asignar — Obtener matriz de asignaciones
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: asignaciones, error } = await supabase
      .from('induccion_asignaciones')
      .select('*')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(asignaciones || [])
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/inducciones/asignar — Asignar lista de inducciones a un barbero
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos para asignar inducciones' }, { status: 403 })
    }

    const body = await request.json()
    const { barbero_id, induccion_ids } = body

    if (!barbero_id || !Array.isArray(induccion_ids)) {
      return NextResponse.json({ error: 'barbero_id e induccion_ids son requeridos' }, { status: 400 })
    }

    // 1. Eliminar asignaciones previas del barbero
    await supabase
      .from('induccion_asignaciones')
      .delete()
      .eq('barbero_id', barbero_id)

    // 2. Insertar nuevas asignaciones si el array no está vacío
    if (induccion_ids.length > 0) {
      const payload = induccion_ids.map((indId: string) => ({
        induccion_id: indId,
        barbero_id: barbero_id,
        asignado_por: user.id
      }))

      const { error: insErr } = await supabase
        .from('induccion_asignaciones')
        .insert(payload)

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, barbero_id, total_asignados: induccion_ids.length })
  } catch (err: any) {
    console.error('Error POST inducciones/asignar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
