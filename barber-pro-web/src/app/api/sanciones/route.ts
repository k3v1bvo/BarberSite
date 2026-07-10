import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: listar sanciones reales (transactions con es_sancion=true) ────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const barbero_id = sp.get('barbero_id')
    const pagadas = sp.get('pagadas') // 'true' | 'false' | '' (todas)

    let query = supabase
      .from('transactions')
      .select('*, empleado:profiles!transactions_empleado_id_fkey(id, full_name, role)')
      .eq('es_sancion', true)
      .order('creado_en', { ascending: false })
      .limit(300)

    if (barbero_id) query = query.eq('empleado_id', barbero_id)
    if (pagadas === 'false') query = query.not('notas', 'like', '%[PAGADO]%')
    if (pagadas === 'true') query = query.like('notas', '%[PAGADO]%')

    const [
      { data: sanciones, error },
      { data: catalogo },
      { data: barberos },
    ] = await Promise.all([
      query,
      supabase.from('plan_cuentas').select('codigo, detalle, tipo').eq('es_sancion', true).order('codigo'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['barbero', 'coordinador']).eq('is_active', true).order('full_name'),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      sanciones: sanciones || [],
      catalogo: catalogo || [],
      barberos: barberos || [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST: crear sanción real ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { barbero_id, cuenta_codigo, cuenta_detalle, glosa, monto, fecha, metodo_pago = 'efectivo' } = body

    if (!barbero_id || !cuenta_codigo || !glosa || !monto) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: barbero } = await supabase
      .from('profiles')
      .select('full_name, ci')
      .eq('id', barbero_id)
      .single()

    const mpLower = String(metodo_pago || 'efectivo').toLowerCase()
    const esDigital = ['qr', 'transferencia', 'banco', 'tarjeta'].includes(mpLower)

    const { data, error } = await supabase.from('transactions').insert({
      libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
      fecha: fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      ci: barbero?.ci || '0000000',
      nombre: barbero?.full_name || 'Empleado',
      cuenta_codigo,
      cuenta_detalle: cuenta_detalle || glosa,
      glosa,
      costo: Number(monto),
      tipo_movimiento: 'INGRESO',
      es_sancion: true,
      empleado_id: barbero_id,
      metodo_pago: mpLower,
      monto_efectivo: mpLower === 'efectivo' ? Number(monto) : 0,
      monto_qr: esDigital ? Number(monto) : 0,
      usuario_registro: profile?.full_name || user.email || 'Sistema',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: marcar sanción como pagada ─────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const { data: tx } = await supabase.from('transactions').select('notas').eq('id', id).single()
    if ((tx?.notas || '').includes('[PAGADO]')) {
      return NextResponse.json({ error: 'Esta sanción ya fue marcada como pagada' }, { status: 400 })
    }

    const { error } = await supabase
      .from('transactions')
      .update({ notas: `${tx?.notas || ''} [PAGADO por ${profile?.full_name || 'admin'} - ${new Date().toLocaleDateString('es-BO')}]` })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
