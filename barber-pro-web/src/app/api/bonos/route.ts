import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: listar bonos con filtros ──────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const barbero_id = sp.get('barbero_id')
    const anio = parseInt(sp.get('anio') || String(new Date().getFullYear()))
    const pagado = sp.get('pagado')
    const periodo_tipo = sp.get('periodo_tipo')

    let query = supabase
      .from('bonos')
      .select('*, barbero:profiles!bonos_barbero_id_fkey(id, full_name, role)')
      .eq('anio', anio)
      .order('creado_en', { ascending: false })

    if (barbero_id) query = query.eq('barbero_id', barbero_id)
    if (pagado === 'true') query = query.eq('pagado', true)
    else if (pagado === 'false') query = query.eq('pagado', false)
    if (periodo_tipo) query = query.eq('periodo_tipo', periodo_tipo)

    const [{ data: bonos, error }, { data: barberos }] = await Promise.all([
      query,
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name'),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bonos: bonos || [], barberos: barberos || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST: crear bono (con egreso automático si pagado=true) ─────────────
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
    const {
      barbero_id, tipo, descripcion, monto,
      periodo_tipo = 'mensual', semana,
      fecha_inicio, fecha_fin, pagado = false,
    } = body

    if (!barbero_id || !tipo || !monto) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Calcular mes y anio a partir de fecha_inicio o fecha actual
    const refDate = fecha_inicio ? new Date(fecha_inicio) : new Date()
    const mes = refDate.getMonth() + 1
    const anio = refDate.getFullYear()

    const { data: bono, error } = await supabase
      .from('bonos')
      .insert({
        barbero_id, tipo, descripcion,
        monto: Number(monto),
        periodo_tipo, semana: semana ?? null,
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        mes, anio, pagado,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Si se crea ya como pagado, generar egreso inmediatamente
    if (pagado && bono) {
      await _registrarEgresoBono(supabase, bono, profile?.full_name || user.email || 'Sistema')
    }

    return NextResponse.json(bono, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: marcar bono como pagado → registra egreso ──────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id, metodo_pago = 'efectivo' } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const { data: bono } = await supabase
      .from('bonos')
      .select('*, barbero:profiles!bonos_barbero_id_fkey(full_name, ci)')
      .eq('id', id)
      .single()

    if (!bono) return NextResponse.json({ error: 'Bono no encontrado' }, { status: 404 })
    if (bono.pagado) return NextResponse.json({ error: 'Bono ya fue pagado' }, { status: 400 })

    // Marcar pagado
    await supabase.from('bonos').update({ pagado: true, pagado_at: new Date().toISOString() }).eq('id', id)

    // Registrar egreso en transactions según método de pago (BANCO o CAJA_CHICA)
    await _registrarEgresoBono(supabase, bono, profile?.full_name || user.email || 'Sistema', metodo_pago)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PUT: Editar bono no pagado ──────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const {
      id, barbero_id, tipo, descripcion, monto,
      periodo_tipo = 'mensual', semana,
      fecha_inicio, fecha_fin, pagado
    } = body

    if (!id || !barbero_id || !tipo || !monto) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: bono, error: findError } = await supabase.from('bonos').select('pagado').eq('id', id).single()
    if (findError || !bono) return NextResponse.json({ error: 'Bono no encontrado' }, { status: 404 })
    if (bono.pagado && pagado === undefined) return NextResponse.json({ error: 'No se puede editar un bono ya pagado' }, { status: 400 })

    const refDate = fecha_inicio ? new Date(fecha_inicio) : new Date()
    const mes = refDate.getMonth() + 1
    const anio = refDate.getFullYear()

    const { data: updated, error } = await supabase
      .from('bonos')
      .update({
        barbero_id, tipo, descripcion,
        monto: Number(monto),
        periodo_tipo, semana: semana ?? null,
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        mes, anio
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(updated, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE: eliminar bono no pagado ─────────────────────────────────────
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
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const { data: bono } = await supabase.from('bonos').select('pagado').eq('id', id).single()
    if (bono?.pagado) return NextResponse.json({ error: 'No se puede eliminar un bono ya pagado' }, { status: 400 })

    const { error } = await supabase.from('bonos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── Helper: registrar egreso en transactions al pagar bono ─────────────
async function _registrarEgresoBono(supabase: any, bono: any, usuarioRegistro: string, metodoPago: string = 'efectivo') {
  const ci = bono.barbero?.ci || '0000000'
  const nombre = bono.barbero?.full_name || 'Empleado'
  const periodoLabel = bono.periodo_tipo === 'semanal'
    ? (bono.semana ? `Semana ${bono.semana}` : `${bono.fecha_inicio || ''}`)
    : bono.periodo_tipo === 'diario'
      ? (bono.fecha_inicio || '')
      : `Mes ${bono.mes}/${bono.anio}`

  const esQrOrBanco = metodoPago.toLowerCase() === 'qr' || metodoPago.toLowerCase() === 'banco'
  const libro = esQrOrBanco ? 'BANCO' : 'CAJA_CHICA'
  const metodo_pago = esQrOrBanco ? 'QR' : 'Efectivo'
  const monto_efectivo = esQrOrBanco ? 0 : Number(bono.monto)
  const monto_qr = esQrOrBanco ? Number(bono.monto) : 0

  await supabase.from('transactions').insert({
    libro,
    fecha: new Date().toISOString().split('T')[0],
    ci,
    nombre,
    cuenta_codigo: '4.1.3',
    cuenta_detalle: 'Bonos a Personal',
    glosa: `Bono ${bono.tipo} (${metodo_pago}) — ${bono.descripcion || ''} (${periodoLabel}) [bono_id: ${bono.id}]`,
    costo: Number(bono.monto),
    metodo_pago,
    monto_efectivo,
    monto_qr,
    tipo_movimiento: 'EGRESO',
    es_sancion: false,
    empleado_id: bono.barbero_id,
    usuario_registro: usuarioRegistro,
  })
}
