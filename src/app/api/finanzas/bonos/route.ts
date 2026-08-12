import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getBoliviaMonth, getBoliviaYear } from '@/lib/asistencia/helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const barbero_id = searchParams.get('barbero_id')
    const solo_pendientes = searchParams.get('pendientes') === 'true'

    let query = supabase
      .from('bonos')
      .select('*, perfiles:profiles!barbero_id(full_name)')
      .order('creado_en', { ascending: false })
      .limit(100)

    if (barbero_id) query = query.eq('barbero_id', barbero_id)
    if (solo_pendientes) query = query.eq('pagado', false)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ bonos: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { barbero_id, tipo, descripcion, monto, mes, anio } = body

    const now = new Date()
    const mesFinal = mes ?? getBoliviaMonth(now)
    const anioFinal = anio ?? getBoliviaYear(now)

    if (!barbero_id || !tipo || !monto || monto <= 0) {
      return NextResponse.json({ error: 'Datos requeridos incompletos' }, { status: 400 })
    }

    const { data: bono, error: bonoError } = await supabase
      .from('bonos')
      .insert({ barbero_id, tipo, descripcion: descripcion || '', monto, mes: mesFinal, anio: anioFinal, pagado: false })
      .select()
      .single()

    if (bonoError) return NextResponse.json({ error: bonoError.message }, { status: 500 })

    // Intentar registrar en transactions (no falla si no existe la cuenta)
    await supabase.from('transactions').insert({
      libro: 'CAJA_CHICA',
      fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now),
      ci: '0000000',
      nombre: 'Bono a Personal',
      cuenta_codigo: 'EGR-BONO',
      cuenta_detalle: 'Bonos al Personal',
      glosa: descripcion || `Bono ${tipo}`,
      costo: monto,
      tipo_movimiento: 'EGRESO',
      es_sancion: false,
      empleado_id: barbero_id,
      usuario_registro: profile.full_name || user.email || 'Sistema',
    }).single()

    return NextResponse.json(bono, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
