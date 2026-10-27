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
    const limit = parseInt(sp.get('limit') || '500', 10)

    let query = supabase
      .from('egresos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(limit)

    let txQuery = supabase
      .from('transactions')
      .select('*')
      .eq('subcategoria', 'COMISION_PAGO')
      .order('fecha', { ascending: false })
      .limit(limit)

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

    const metodoPago = String(body.metodo_pago || 'efectivo').toLowerCase()
    const isDigital = ['qr', 'tarjeta', 'transferencia', 'banco'].includes(metodoPago)
    const montoEfectivo = metodoPago === 'mixto' ? (Number(body.monto_efectivo) || 0) : (metodoPago === 'efectivo' ? montoNeto : 0)
    const montoQr = metodoPago === 'mixto' ? (Number(body.monto_qr) || 0) : (isDigital ? montoNeto : 0)

    const cuentaCodigoFinal = body.cuenta_codigo || 'EGR-GEN'
    // Asegurar que la cuenta exista en plan_cuentas para evitar error de FK (egresos_cuenta_codigo_fkey y transactions_cuenta_codigo_fkey)
    await supabase.from('plan_cuentas').upsert({
      codigo: cuentaCodigoFinal,
      detalle: body.cuenta_codigo ? (body.concepto || 'Egreso Registrado') : 'Gastos Generales / Varios',
      tipo: 'EGRESO',
      nivel: cuentaCodigoFinal.split('.').length || 1,
      es_sancion: false
    }, { onConflict: 'codigo', ignoreDuplicates: true })

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
        cuenta_codigo: cuentaCodigoFinal,
        metodo_pago: metodoPago,
        monto_efectivo: montoEfectivo,
        monto_qr: montoQr,
        usuario_registro: profile?.full_name || user.email || 'Sistema',
        notas: body.notas || null,
        comprobante_url: body.comprobante_url || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('metodo_pago') || error.message?.includes('monto_')) {
        const { data: fbData, error: fbError } = await supabase
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
            cuenta_codigo: cuentaCodigoFinal,
            usuario_registro: profile?.full_name || user.email || 'Sistema',
            notas: body.notas || null,
            comprobante_url: body.comprobante_url || null,
          })
          .select()
          .single()
        if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 })
        return NextResponse.json(fbData, { status: 201 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Insertar en transactions para el reporte financiero
    const { error: txError } = await supabase.from('transactions').insert({
      libro: metodoPago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
      fecha: body.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      ci: '0000000',
      nombre: body.proveedor || 'Egreso General',
      cuenta_codigo: cuentaCodigoFinal,
      cuenta_detalle: body.concepto,
      glosa: body.notas || body.concepto,
      costo: montoBruto,
      tipo_movimiento: 'EGRESO',
      es_sancion: false,
      metodo_pago: metodoPago,
      monto_efectivo: montoEfectivo,
      monto_qr: montoQr,
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

// PATCH /api/egresos — actualizar egreso o comprobante
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
    const { id } = body
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (String(id).startsWith('comision_tx_')) {
      const txId = String(id).replace('comision_tx_', '')
      const txUpdate: any = {}
      if (body.comprobante_url !== undefined) txUpdate.comprobante_url = body.comprobante_url
      if (body.monto_bruto !== undefined || body.costo !== undefined) txUpdate.costo = Number(body.monto_bruto || body.costo)
      if (body.concepto !== undefined) txUpdate.cuenta_detalle = body.concepto
      if (body.metodo_pago !== undefined) txUpdate.metodo_pago = body.metodo_pago
      if (body.notas !== undefined) txUpdate.glosa = body.notas

      const { data, error } = await supabase
        .from('transactions')
        .update(txUpdate)
        .eq('id', txId)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    // Obtener egreso anterior
    const { data: oldEgreso } = await supabase
      .from('egresos')
      .select('*')
      .eq('id', id)
      .single()

    const updatePayload: any = {}
    if (body.comprobante_url !== undefined) updatePayload.comprobante_url = body.comprobante_url
    if (body.concepto !== undefined) updatePayload.concepto = body.concepto
    if (body.proveedor !== undefined) updatePayload.proveedor = body.proveedor || null
    if (body.cuenta_codigo !== undefined) updatePayload.cuenta_codigo = body.cuenta_codigo
    if (body.numero_factura !== undefined) updatePayload.numero_factura = body.numero_factura || null
    if (body.notas !== undefined) updatePayload.notas = body.notas || null
    if (body.fecha !== undefined) updatePayload.fecha = body.fecha
    if (body.tiene_factura !== undefined) updatePayload.tiene_factura = Boolean(body.tiene_factura)

    let montoBruto = oldEgreso ? Number(oldEgreso.monto_bruto || 0) : 0
    if (body.monto_bruto !== undefined) {
      montoBruto = Number(body.monto_bruto) || 0
      updatePayload.monto_bruto = montoBruto
    }

    const tieneFactura = body.tiene_factura !== undefined ? Boolean(body.tiene_factura) : Boolean(oldEgreso?.tiene_factura)
    const iva = tieneFactura ? montoBruto * 0.13 : 0
    const it = tieneFactura ? montoBruto * 0.03 : 0
    const montoNeto = montoBruto - iva - it
    updatePayload.iva = iva
    updatePayload.it = it
    updatePayload.monto_neto = montoNeto

    const metodoPago = String(body.metodo_pago !== undefined ? body.metodo_pago : (oldEgreso?.metodo_pago || 'efectivo')).toLowerCase()
    const isDigital = ['qr', 'tarjeta', 'transferencia', 'banco'].includes(metodoPago)
    updatePayload.metodo_pago = metodoPago
    if (body.monto_efectivo !== undefined) {
      updatePayload.monto_efectivo = Number(body.monto_efectivo) || 0
    } else if (metodoPago === 'efectivo') {
      updatePayload.monto_efectivo = montoNeto
    }
    if (body.monto_qr !== undefined) {
      updatePayload.monto_qr = Number(body.monto_qr) || 0
    } else if (isDigital) {
      updatePayload.monto_qr = montoNeto
    }

    const { data, error } = await supabase
      .from('egresos')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Sincronizar en transactions
    if (oldEgreso) {
      const txUpdate: any = {}
      if (updatePayload.concepto) txUpdate.cuenta_detalle = updatePayload.concepto
      if (updatePayload.proveedor !== undefined) txUpdate.nombre = updatePayload.proveedor || 'Egreso General'
      if (updatePayload.monto_bruto !== undefined) txUpdate.costo = updatePayload.monto_bruto
      if (updatePayload.metodo_pago) {
        txUpdate.metodo_pago = updatePayload.metodo_pago
        txUpdate.libro = updatePayload.metodo_pago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO'
      }
      if (updatePayload.monto_efectivo !== undefined) txUpdate.monto_efectivo = updatePayload.monto_efectivo
      if (updatePayload.monto_qr !== undefined) txUpdate.monto_qr = updatePayload.monto_qr
      if (updatePayload.comprobante_url !== undefined) txUpdate.comprobante_url = updatePayload.comprobante_url
      if (updatePayload.fecha) txUpdate.fecha = updatePayload.fecha
      if (updatePayload.notas !== undefined || updatePayload.concepto !== undefined) {
        txUpdate.glosa = updatePayload.notas || updatePayload.concepto || oldEgreso.concepto
      }

      await supabase
        .from('transactions')
        .update(txUpdate)
        .eq('tipo_movimiento', 'EGRESO')
        .eq('fecha', oldEgreso.fecha)
        .eq('costo', oldEgreso.monto_bruto)
        .eq('cuenta_detalle', oldEgreso.concepto)
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/egresos — eliminar egreso
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (String(id).startsWith('comision_tx_')) {
      const txId = String(id).replace('comision_tx_', '')
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Obtener datos del egreso antes de borrar
    const { data: egresoData } = await supabase
      .from('egresos')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('egresos')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Eliminar también de transactions
    if (egresoData) {
      await supabase
        .from('transactions')
        .delete()
        .eq('tipo_movimiento', 'EGRESO')
        .eq('fecha', egresoData.fecha)
        .eq('costo', egresoData.monto_bruto)
        .eq('cuenta_detalle', egresoData.concepto)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
