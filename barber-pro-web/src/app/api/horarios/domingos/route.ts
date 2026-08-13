import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface DomingoAsignacion {
  fecha: string // YYYY-MM-DD (fecha del domingo)
  barberos_habilitados: string[] // Array de UUIDs de barberos que trabajan
  notas?: string
}

/** GET: Obtener asignaciones de domingos rotativos */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'domingos_rotativos_config')
      .maybeSingle()

    const domingos: DomingoAsignacion[] = (data?.valor as any)?.domingos ?? []
    return NextResponse.json({ domingos })
  } catch (err: any) {
    console.error('GET /api/horarios/domingos error:', err)
    return NextResponse.json({ domingos: [] })
  }
}

/** POST: Guardar o actualizar la asignación de domingos rotativos */
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

    const { domingos } = await request.json()
    if (!Array.isArray(domingos)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('sistema_config')
      .upsert({
        clave: 'domingos_rotativos_config',
        valor: { domingos },
        updated_at: new Date().toISOString(),
      })

    if (error) throw error

    return NextResponse.json({ ok: true, domingos })
  } catch (err: any) {
    console.error('POST /api/horarios/domingos error:', err)
    return NextResponse.json({ error: err?.message || 'Error al guardar domingos rotativos' }, { status: 500 })
  }
}
