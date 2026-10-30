import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: listar sanciones (desde tabla sanciones o fallback a transactions) ────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'coordinador'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const adminSupabase = await createServerAdminClient()
    const sp = request.nextUrl.searchParams
    const barbero_id = sp.get('barbero_id')
    const pagadas = sp.get('pagadas') // 'true' | 'false' | '' (todas)

    // Consultar catálogo y barberos en paralelo
    const [
      { data: catalogo },
      { data: barberos },
    ] = await Promise.all([
      adminSupabase.from('plan_cuentas').select('codigo, detalle, tipo').eq('es_sancion', true).order('codigo'),
      adminSupabase.from('profiles').select('id, full_name, role').in('role', ['barbero', 'coordinador']).eq('is_active', true).order('full_name'),
    ])

    // Intentar consultar tabla dedicada `sanciones`
    let query = adminSupabase
      .from('sanciones')
      .select('*, empleado:profiles!sanciones_barbero_id_fkey(id, full_name, role)')
      .order('creado_en', { ascending: false })
      .limit(300)

    if (barbero_id) query = query.eq('barbero_id', barbero_id)
    if (pagadas === 'false') query = query.eq('estado', 'pendiente')
    if (pagadas === 'true') query = query.in('estado', ['pagada', 'aplicada'])

    const { data: sancionesData, error: sError } = await query

    // Si la tabla sanciones existe y funcionó, retornarla
    if (!sError && sancionesData) {
      return NextResponse.json({
        sanciones: sancionesData,
        catalogo: catalogo || [],
        barberos: barberos || [],
      })
    }

    // Fallback inteligente: la tabla sanciones no existe o dio PGRST205, consultar transactions (donde es_sancion = true)
    let txQuery = adminSupabase
      .from('transactions')
      .select('*, empleado:profiles!empleado_id(id, full_name, role)')
      .eq('es_sancion', true)
      .order('fecha', { ascending: false })
      .limit(300)

    if (barbero_id) txQuery = txQuery.eq('empleado_id', barbero_id)

    const { data: txList, error: txError } = await txQuery
    if (txError) {
      console.error('Error fallback transactions sanciones:', txError)
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    const mappedSanciones = (txList || []).map((tx: any) => {
      const isPagada = tx.notas?.includes('pagad') || ['efectivo', 'qr', 'transferencia', 'banco', 'tarjeta'].includes(String(tx.metodo_pago || '').toLowerCase())
      return {
        id: tx.id,
        fecha: tx.fecha,
        barbero_id: tx.empleado_id,
        empleado: tx.empleado || { id: tx.empleado_id, full_name: tx.nombre },
        tipo: tx.cuenta_detalle || 'Sanción Administrativa',
        descripcion: tx.glosa || '',
        monto: Number(tx.costo) || 0,
        estado: isPagada ? 'pagada' : 'pendiente',
        creado_en: tx.creado_en || `${tx.fecha}T00:00:00Z`,
        pagado_at: isPagada ? (tx.creado_en || `${tx.fecha}T00:00:00Z`) : null,
      }
    }).filter((s: any) => {
      if (pagadas === 'false') return s.estado === 'pendiente'
      if (pagadas === 'true') return s.estado === 'pagada'
      return true
    })

    return NextResponse.json({
      sanciones: mappedSanciones,
      catalogo: catalogo || [],
      barberos: barberos || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
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

    const adminSupabase = await createServerAdminClient()
    const body = await request.json()
    const { barbero_id, cuenta_codigo, cuenta_detalle, glosa, monto } = body

    if (!barbero_id || !cuenta_codigo || !monto) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Asegurar que la cuenta exista en plan_cuentas como sanción
    await adminSupabase.from('plan_cuentas').upsert({
      codigo: cuenta_codigo,
      detalle: cuenta_detalle || 'Sanción Administrativa',
      tipo: 'INGRESO',
      nivel: 1,
      es_sancion: true,
    }, { onConflict: 'codigo', ignoreDuplicates: true })

    // 1. Intentar insertar en tabla sanciones
    const { data: sancionData, error: sErr } = await adminSupabase.from('sanciones').insert({
      barbero_id,
      tipo: cuenta_detalle || 'Sanción Administrativa',
      descripcion: glosa || '',
      monto: Number(monto),
      estado: 'pendiente'
    }).select().single()

    if (!sErr && sancionData) {
      return NextResponse.json(sancionData, { status: 201 })
    }

    // 2. Si no existe la tabla sanciones (PGRST205), registrar en transactions como sanción pendiente
    const { data: barberoProfile } = await adminSupabase.from('profiles').select('full_name, ci').eq('id', barbero_id).single()
    const fechaHoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const { data: txSancion, error: txErr } = await adminSupabase.from('transactions').insert({
      libro: 'CAJA_CHICA',
      fecha: fechaHoy,
      ci: barberoProfile?.ci || '0000000',
      nombre: barberoProfile?.full_name || 'Empleado',
      cuenta_codigo: cuenta_codigo,
      cuenta_detalle: cuenta_detalle || 'Sanción Administrativa',
      glosa: glosa || 'Sanción',
      costo: Number(monto),
      tipo_movimiento: 'SANCCION',
      subcategoria: 'SANCION',
      es_sancion: true,
      empleado_id: barbero_id,
      metodo_pago: 'descuento_caja',
      notas: 'pendiente',
      usuario_registro: profile?.full_name || user.email || 'Sistema'
    }).select().single()

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 })
    }

    return NextResponse.json({
      id: txSancion.id,
      barbero_id,
      tipo: cuenta_detalle || 'Sanción Administrativa',
      descripcion: glosa || '',
      monto: Number(monto),
      estado: 'pendiente',
      creado_en: txSancion.creado_en || new Date().toISOString()
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
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

    const adminSupabase = await createServerAdminClient()
    const { id, metodo_pago, comprobante_url } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const mpLower = String(metodo_pago || 'efectivo').toLowerCase()
    const esDigital = ['qr', 'transferencia', 'banco', 'tarjeta'].includes(mpLower)
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    // Asegurar cuenta contable ING-SANCION
    await adminSupabase.from('plan_cuentas').upsert({
      codigo: 'ING-SANCION',
      detalle: 'Recuperación por Sanción a Personal',
      tipo: 'INGRESO',
      nivel: 1,
      es_sancion: false,
    }, { onConflict: 'codigo', ignoreDuplicates: true })

    // Intentar buscar en tabla sanciones
    const { data: sancion } = await adminSupabase
      .from('sanciones')
      .select('*, barbero:profiles!sanciones_barbero_id_fkey(ci, full_name)')
      .eq('id', id)
      .maybeSingle()

    if (sancion) {
      if (sancion.estado !== 'pendiente') {
        return NextResponse.json({ error: 'La sanción no está pendiente' }, { status: 400 })
      }

      await adminSupabase.from('transactions').insert({
        libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
        fecha,
        ci: sancion.barbero?.ci || '0000000',
        nombre: sancion.barbero?.full_name || 'Empleado',
        cuenta_codigo: 'ING-SANCION',
        cuenta_detalle: sancion.tipo || 'Pago Sanción',
        glosa: `Cobro manual de sanción: ${sancion.descripcion}`,
        costo: Number(sancion.monto),
        tipo_movimiento: 'INGRESO',
        subcategoria: 'SANCION_COBRO',
        es_sancion: false,
        empleado_id: sancion.barbero_id,
        metodo_pago: mpLower,
        monto_efectivo: esDigital ? 0 : Number(sancion.monto),
        monto_qr: esDigital ? Number(sancion.monto) : 0,
        comprobante_url: comprobante_url || null,
        usuario_registro: profile?.full_name || user.email || 'Sistema',
        notas: 'Cobro de sanción (Manual)'
      })

      await adminSupabase
        .from('sanciones')
        .update({ estado: 'pagada', pagado_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json({ success: true })
    }

    // Fallback: buscar y actualizar en tabla transactions
    const { data: txOriginal } = await adminSupabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (txOriginal) {
      const costo = Number(txOriginal.costo) || 0
      await adminSupabase
        .from('transactions')
        .update({
          libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
          metodo_pago: mpLower,
          tipo_movimiento: 'INGRESO',
          monto_efectivo: esDigital ? 0 : costo,
          monto_qr: esDigital ? costo : 0,
          notas: 'pagada (Cobro Manual)',
          comprobante_url: comprobante_url || txOriginal.comprobante_url || null,
        })
        .eq('id', id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Sanción no encontrada' }, { status: 404 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
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

    const adminSupabase = await createServerAdminClient()
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta ID de sanción' }, { status: 400 })

    // Intentar borrar en tabla sanciones
    const { error: sDelErr } = await adminSupabase.from('sanciones').delete().eq('id', id)
    if (!sDelErr) {
      return NextResponse.json({ success: true, mensaje: 'Sanción eliminada con éxito' })
    }

    // Fallback: borrar de transactions
    const { error: txDelErr } = await adminSupabase.from('transactions').delete().eq('id', id)
    if (txDelErr) return NextResponse.json({ error: txDelErr.message }, { status: 500 })

    return NextResponse.json({ success: true, mensaje: 'Sanción eliminada con éxito' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno al eliminar sanción' }, { status: 500 })
  }
}
