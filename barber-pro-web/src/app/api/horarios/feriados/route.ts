import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface FeriadoItem {
  id: string
  fecha: string // YYYY-MM-DD
  nombre: string
  tipo: 'cerrado' | 'con_atencion'
  hora_inicio?: string
  hora_fin?: string
  descripcion?: string
}

/** GET: Obtener lista de feriados configurados */
export async function GET() {
  try {
    const adminSupabase = await createServerAdminClient()
    const { data } = await adminSupabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'feriados_config')
      .maybeSingle()

    const feriados: FeriadoItem[] = (data?.valor as any)?.feriados ?? []
    return NextResponse.json({ feriados })
  } catch (err: any) {
    console.error('GET /api/horarios/feriados error:', err)
    return NextResponse.json({ feriados: [] })
  }
}

/** POST: Crear o actualizar la lista completa de feriados */
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

    const { feriados } = await request.json()
    if (!Array.isArray(feriados)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    const adminSupabase = await createServerAdminClient()
    const { error } = await adminSupabase
      .from('sistema_config')
      .upsert({
        clave: 'feriados_config',
        valor: { feriados },
        updated_at: new Date().toISOString(),
      })

    if (error) throw error

    return NextResponse.json({ ok: true, feriados })
  } catch (err: any) {
    console.error('POST /api/horarios/feriados error:', err)
    return NextResponse.json({ error: err?.message || 'Error al guardar feriados' }, { status: 500 })
  }
}
