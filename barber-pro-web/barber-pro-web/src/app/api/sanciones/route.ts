import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: listar sanciones (desde tabla sanciones) ────
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
      .from('sanciones')
      .select('*, empleado:profiles!sanciones_barbero_id_fkey(id, full_name, role)')
      .order('creado_en', { ascending: false })
      .limit(300)

    if (barbero_id) query = query.eq('barbero_id', barbero_id)
    if (pagadas === 'false') query = query.eq('estado', 'pendiente')
    if (pagadas === 'true') query = query.in('estado', ['pagada', 'aplicada'])

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

// ── POST: crear sanción como deuda (estado pendiente) ────────────────
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
    const { barbero_id, cuenta_codigo, cuenta_detalle, glosa, monto } = body

    if (!barbero_id || !cuenta_codigo || !monto) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase.from('sanciones').insert({
      barbero_id,
      tipo: cuenta_detalle || 'Sanción Administrativa',
      descripcion: glosa || '',
      monto: Number(monto),
      estado: 'pendiente'
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: cobrar sanción en efectivo/QR (pasa a pagada y crea INGRESO) ──
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id, metodo_pago, comprobante_url } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const { data: sancion } = await supabase.from('sanciones').select('*, barbero:profiles!sanciones_barbero_id_fkey(ci, full_name)').eq('id', id).single()
    if (!sancion || sancion.estado !== 'pendiente') {
      return NextResponse.json({ error: 'La sanción no está pendiente' }, { status: 400 })
    }

    // Insertar en transactions (INGRESO real de dinero)
    const mpLower = String(metodo_pago || 'efectivo').toLowerCase()
    const esDigital = ['qr', 'transferencia', 'banco', 'tarjeta'].includes(mpLower)
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const { error: txError } = await supabase.from('transactions').insert({
      libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
      fecha,
      ci: sancion.barbero?.ci || '0000000',
      nombre: sancion.barbero?.full_name || 'Empleado',
      cuenta_codigo: 'ING-SANCION', // o el código original, pero 'ING-SANCION' es claro
      cuenta_detalle: sancion.tipo || 'Pago Sanción',
      glosa: `Cobro manual de sanción: ${sancion.descripcion}`,
      costo: Number(sancion.monto),
      tipo_movimiento: 'INGRESO',
      es_sancion: false, // Es un ingreso normal recuperado
      empleado_id: sancion.barbero_id,
      metodo_pago: mpLower,
      comprobante_url: comprobante_url || null,
      usuario_registro: profile?.full_name || user.email || 'Sistema',
      notas: 'Cobro de sanción (Manual)'
    })

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

    // Marcar sanción como pagada
    const { error: updateError } = await supabase
      .from('sanciones')
      .update({ estado: 'pagada', pagado_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE: eliminar / anular sanción ──────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta ID de sanción' }, { status: 400 })

    const { error } = await supabase.from('sanciones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, mensaje: 'Sanción eliminada con éxito' })
  } catch {
    return NextResponse.json({ error: 'Error interno al eliminar sanción' }, { status: 500 })
  }
}
