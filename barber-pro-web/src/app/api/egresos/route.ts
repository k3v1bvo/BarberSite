import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/egresos — listar egresos
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

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const desde = sp.get('desde')
    const hasta = sp.get('hasta')

    let query = supabase
      .from('egresos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100)

    let txQuery = supabase
      .from('transactions')
      .select('*')
      .eq('subcategoria', 'COMISION_PAGO')
      .order('fecha', { ascending: false })
      .limit(100)

    if (desde) {
      query = query.gte('fecha', desde)
      txQuery = txQuery.gte('fecha', desde)
    }
    if (hasta) {
      query = query.lte('fecha', hasta)
      txQuery = txQuery.lte('fecha', hasta)
    }

    const [egrRes, txRes] = await Promise.all([query, txQuery])
    if (egrRes.error) return NextResponse.json({ error: egrRes.error.message }, { status: 500 })

    const listaEgresos = egrRes.data || []
    const egresoNotasSet = new Set(listaEgresos.map((e: any) => `${e.fecha}_${e.monto_bruto}_${e.notas || ''}`))

    const virtualesComision = (txRes.data || [])
      .filter((tx: any) => !egresoNotasSet.has(`${tx.fecha}_${tx.costo}_${tx.glosa || ''}`))
      .map((tx: any) => ({
        id: `comision_tx_${tx.id}`,
        fecha: tx.fecha,
        concepto: tx.cuenta_detalle || 'Pago de Comisiones / Sueldos',
        proveedor: tx.nombre?.replace('Pago Comisiones a ', '') || 'Barbero',
        monto_bruto: tx.costo,
        tiene_factura: false,
        iva: 0,
        it: 0,
        monto_neto: tx.costo,
        cuenta_codigo: tx.cuenta_codigo || 'EGR-COM',
        metodo_pago: tx.metodo_pago || 'efectivo',
        monto_efectivo: tx.monto_efectivo || (tx.metodo_pago === 'efectivo' ? tx.costo : 0),
        monto_qr: tx.monto_qr || (tx.metodo_pago === 'qr' ? tx.costo : 0),
        usuario_registro: tx.usuario_registro || 'Sistema',
        notas: tx.glosa || null,
        comprobante_url: tx.comprobante_url || null,
      }))

    const finalLista = [...listaEgresos.map((e: any) => ({ ...e, comprobante_url: e.comprobante_url || null })), ...virtualesComision].sort((a: any, b: any) => b.fecha.localeCompare(a.fecha))
    return NextResponse.json(finalLista)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/egresos — crear egreso
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

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()

    const montoBruto = Number(body.monto_bruto) || 0
    const iva = body.tiene_factura ? montoBruto * 0.13 : 0
    const it = body.tiene_factura ? montoBruto * 0.03 : 0
    const montoNeto = montoBruto - iva - it

    const metodoPago = body.metodo_pago || 'efectivo'
    const montoEfectivo = metodoPago === 'mixto' ? (Number(body.monto_efectivo) || 0) : (metodoPago === 'efectivo' ? montoNeto : 0)
    const montoQr = metodoPago === 'mixto' ? (Number(body.monto_qr) || 0) : (metodoPago === 'qr' ? montoNeto : 0)

    const { data, error } = await supabase
      .from('egresos')
      .insert({
        fecha: body.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        concepto: body.concepto,
        proveedor: body.proveedor || null,
        monto_bruto: montoBruto,
        tiene_factura: body.tiene_factura || false,
        iva,
        it,
        monto_neto: montoNeto,
        numero_factura: body.numero_factura || null,
        cuenta_codigo: body.cuenta_codigo || null,
        metodo_pago: metodoPago,
        monto_efectivo: montoEfectivo,
        monto_qr: montoQr,
        usuario_registro: profile?.full_name || user.email || 'Sistema',
        notas: body.notas || null,
        comprobante_url: body.comprobante_url || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Insertar en transactions para el reporte financiero
    const { error: txError } = await supabase.from('transactions').insert({
      libro: metodoPago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
      fecha: body.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      ci: '0000000',
      nombre: body.proveedor || 'Egreso General',
      cuenta_codigo: body.cuenta_codigo || 'EGR-GEN',
      cuenta_detalle: body.concepto,
      glosa: body.notas || body.concepto,
      costo: montoBruto,
      tipo_movimiento: 'EGRESO',
      es_sancion: false,
      metodo_pago: metodoPago,
      subcategoria: 'GASTO_GENERAL',
      notas: metodoPago === 'mixto' ? `Efectivo: Bs ${montoEfectivo} | QR: Bs ${montoQr}` : null,
      usuario_registro: profile?.full_name || 'Sistema',
      comprobante_url: body.comprobante_url || null,
    })

    if (txError) {
      console.error("Error inserting into transactions for egreso:", txError)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// PATCH /api/egresos — actualizar comprobante_url de un egreso
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { id, comprobante_url } = body
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (String(id).startsWith('comision_tx_')) {
      const txId = String(id).replace('comision_tx_', '')
      const { data, error } = await supabase
        .from('transactions')
        .update({ comprobante_url })
        .eq('id', txId)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    const { data, error } = await supabase
      .from('egresos')
      .update({ comprobante_url })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
