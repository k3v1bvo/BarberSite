import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/arqueo?fecha=YYYY-MM-DD — resumen del día
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

    if (request.nextUrl.searchParams.get('historial') === 'true') {
      const { data: closures, error } = await supabase
        .from('daily_closures')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(50)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Consultar también si tienen comprobante en transactions de cierre (EGR-CIE) por fecha
      const fechas = (closures || []).map((c: any) => c.fecha)
      const { data: txCierres } = await supabase
        .from('transactions')
        .select('fecha, comprobante_url')
        .eq('cuenta_codigo', 'EGR-CIE')
        .in('fecha', fechas)

      const txMap = new Map((txCierres || []).map((t: any) => [t.fecha, t.comprobante_url]))

      const enriched = (closures || []).map((c: any) => ({
        ...c,
        comprobante_url: c.comprobante_url || txMap.get(c.fecha) || null,
      }))

      return NextResponse.json(enriched)
    }

    const fecha = request.nextUrl.searchParams.get('fecha') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const dObj = new Date(`${fecha}T12:00:00Z`)
    const nextObj = new Date(dObj.getTime() + 86400000)
    const nextDayStr = nextObj.toISOString().split('T')[0]

    // Auto-reparar registros guardados con fecha UTC errónea en este día boliviano
    await supabase
      .from('transactions')
      .update({ fecha })
      .eq('fecha', nextDayStr)
      .not('monto_qr', 'is', null)

    const { data: txDia } = await supabase
      .from('transactions')
      .select('libro, costo, metodo_pago, es_sancion, tipo_movimiento, monto_efectivo, monto_qr')
      .eq('fecha', fecha)

    const { data: citasDia } = await supabase
      .from('citas')
      .select('id, precio, anticipo_monto, metodo_pago, barbero_id, cliente_id, comision_pagada, comision_barbero')
      .gte('fecha_hora', `${fecha}T00:00:00`)
      .lte('fecha_hora', `${fecha}T23:59:59`)
      .eq('estado', 'completado')

    const comisionesPendientes = (citasDia || []).filter(c => c.comision_pagada === false && Number(c.comision_barbero || 0) > 0)
    const comisiones_pendientes_count = comisionesPendientes.length
    const comisiones_pendientes_monto = comisionesPendientes.reduce((acc, c) => acc + Number(c.comision_barbero || 0), 0)

    const txServiciosCount = txDia?.filter(t => t.libro === 'SERVICIOS' && t.tipo_movimiento === 'INGRESO').length || 0
    const citasCompletadasCount = citasDia?.length || 0
    const cantidad_servicios = Math.max(citasCompletadasCount, txServiciosCount)

    const resumen = {
      fecha,
      caja_chica: 0,
      ventas: 0,
      servicios: 0,
      banco: 0,
      uso_tienda: 0,
      total_registrado: 0,
      total_efectivo: 0,
      total_qr: 0,
      total_tarjeta: 0,
      total_descuento_caja: 0,
      sanciones: 0,
      movimientos: txDia?.length || 0,
      cantidad_servicios,
      comisiones_pendientes_count,
      comisiones_pendientes_monto,
    }
    txDia?.forEach((t: any) => {
      const costo = Number(t.costo)
      const isIngreso = t.tipo_movimiento === 'INGRESO'
      const isEgreso = t.tipo_movimiento === 'EGRESO'

      if (t.libro === 'CAJA_CHICA') resumen.caja_chica += (isIngreso ? costo : -costo)
      else if (t.libro === 'VENTAS') resumen.ventas += (isIngreso ? costo : -costo)
      else if (t.libro === 'SERVICIOS') resumen.servicios += (isIngreso ? costo : -costo)
      else if (t.libro === 'BANCO') resumen.banco += (isIngreso ? costo : -costo)
      else if (t.libro === 'USO_TIENDA') resumen.uso_tienda += (isIngreso ? costo : -costo)
      
      if (isIngreso) {
        resumen.total_registrado += costo
      } else if (isEgreso) {
        resumen.total_registrado -= costo
      }

      if (t.es_sancion) resumen.sanciones += costo
      
      // Manejar métodos de pago con montos mixtos
      const mEfectivo = t.metodo_pago === 'mixto' ? Number(t.monto_efectivo || 0) : (t.metodo_pago === 'efectivo' ? costo : 0)
      const mQr = t.metodo_pago === 'mixto' ? Number(t.monto_qr || 0) : (t.metodo_pago === 'qr' ? costo : 0)
      
      if (isIngreso) {
        resumen.total_efectivo += mEfectivo
        resumen.total_qr += mQr
        if (t.metodo_pago === 'tarjeta') resumen.total_tarjeta += costo
      } else if (isEgreso) {
        resumen.total_efectivo -= mEfectivo
        resumen.total_qr -= mQr
        if (t.metodo_pago === 'tarjeta') resumen.total_tarjeta -= costo
      }
    })

    const citasMonto = (citasDia || []).reduce((acc, c) => acc + Number(c.precio || 0), 0)
    if (resumen.servicios < citasMonto) {
      const diff = citasMonto - resumen.servicios
      resumen.servicios = citasMonto
      resumen.total_registrado += diff

      let citasQrBanco = 0
      let citasEfectivo = 0
      ;(citasDia || []).forEach(c => {
        const total = Number(c.precio || 0)
        const anticipo = Number(c.anticipo_monto || 0)
        const saldo = Math.max(0, total - anticipo)
        const mp = String(c.metodo_pago || 'efectivo').toLowerCase()

        // El anticipo de reserva siempre es pago digital (QR / Banco)
        citasQrBanco += anticipo
        if (mp === 'qr' || mp === 'tarjeta' || mp === 'transferencia' || mp === 'banco') {
          citasQrBanco += saldo
        } else {
          citasEfectivo += saldo
        }
      })

      const qrActual = resumen.total_qr + resumen.total_tarjeta
      if (qrActual < citasQrBanco) {
        const diffQr = citasQrBanco - qrActual
        resumen.total_qr += diffQr
        resumen.banco += diffQr
      }
      const efActual = resumen.total_efectivo
      if (efActual < citasEfectivo) {
        const diffEf = citasEfectivo - efActual
        resumen.total_efectivo += diffEf
      }
    }

    // Traer cierre existente
    const { data: cierre } = await supabase
      .from('daily_closures')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()

    return NextResponse.json({ resumen, cierre })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/arqueo — cerrar el día (o actualizar cierre)
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
    const fecha = body.fecha || new Date().toISOString().split('T')[0]

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('daily_closures')
      .select('id, cerrado')
      .eq('fecha', fecha)
      .maybeSingle()

    if (existing?.cerrado) {
      return NextResponse.json({ error: 'El arqueo de este día ya fue cerrado' }, { status: 400 })
    }

    const usuarioCierre = body.usuario_cierre || profile?.full_name || user.email || 'Sistema'

    if (body.cerrado && body.pago_cierre && Number(body.pago_cierre.monto) > 0) {
      const pMonto = Number(body.pago_cierre.monto)
      const pMetodo = body.pago_cierre.metodo_pago || 'efectivo'
      const pPersona = body.pago_cierre.persona || usuarioCierre
      const pComprobante = body.pago_cierre.comprobante_url || null

      await supabase.from('transactions').insert({
        libro: pMetodo === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
        fecha,
        ci: '0000000',
        nombre: `Pago Cierre de Caja a ${pPersona}`,
        cuenta_codigo: 'EGR-CIE',
        cuenta_detalle: 'Pago por Cierre de Caja Diario',
        glosa: `Bono por cerrar caja el día ${fecha}`,
        costo: pMonto,
        tipo_movimiento: 'EGRESO',
        es_sancion: false,
        metodo_pago: pMetodo,
        subcategoria: 'PAGO_CIERRE_CAJA',
        monto_efectivo: pMetodo === 'efectivo' ? pMonto : 0,
        monto_qr: pMetodo === 'qr' ? pMonto : 0,
        usuario_registro: profile?.full_name || 'Sistema',
        comprobante_url: pComprobante
      })

      await supabase.from('egresos').insert({
        fecha,
        concepto: 'Pago por Cierre de Caja Diario',
        proveedor: pPersona,
        monto_bruto: pMonto,
        tiene_factura: false,
        iva: 0,
        it: 0,
        monto_neto: pMonto,
        cuenta_codigo: 'EGR-CIE',
        metodo_pago: pMetodo,
        monto_efectivo: pMetodo === 'efectivo' ? pMonto : 0,
        monto_qr: pMetodo === 'qr' ? pMonto : 0,
        usuario_registro: profile?.full_name || 'Sistema',
        notas: `Bono por cerrar caja el día ${fecha}`
      })
    }

    const row = {
      fecha,
      caja_chica: body.caja_chica || 0,
      ventas: body.ventas || 0,
      servicios: body.servicios || 0,
      banco: body.banco || 0,
      total_efectivo_fisico: body.total_efectivo_fisico || 0,
      total_qr: body.total_qr || 0,
      observaciones: body.observaciones || null,
      usuario_cierre: usuarioCierre,
      cerrado: body.cerrado ?? false,
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('daily_closures')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      const { data, error } = await supabase
        .from('daily_closures')
        .insert(row)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH /api/arqueo — actualizar comprobante_url de un cierre diario
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { id, fecha, comprobante_url } = body

    if (id) {
      await supabase.from('daily_closures').update({ comprobante_url }).eq('id', id)
    }

    if (fecha) {
      await supabase
        .from('transactions')
        .update({ comprobante_url })
        .eq('fecha', fecha)
        .eq('cuenta_codigo', 'EGR-CIE')
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
