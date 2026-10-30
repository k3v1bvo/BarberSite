import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getBoliviaDateString } from '@/lib/asistencia/helpers'

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
        .limit(365)
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

    const { data: txDia } = await supabase
      .from('transactions')
      .select('id, libro, costo, metodo_pago, es_sancion, tipo_movimiento, monto_efectivo, monto_qr, glosa, nombre, cuenta_detalle, cuenta_codigo, creado_en')
      .order('creado_en', { ascending: false })
      .eq('fecha', fecha)

    const { data: citasDia } = await supabase
      .from('citas')
      .select('id, precio, anticipo_monto, created_at, metodo_pago, monto_efectivo, monto_transferencia, barbero_id, cliente_id, comision_pagada, comision_barbero, notas')
      .gte('fecha_hora', `${fecha}T00:00:00-04:00`)
      .lte('fecha_hora', `${fecha}T23:59:59-04:00`)
      .eq('estado', 'completado')

    const getCitaNeto = (c: any) => {
      const matchNeto = (c.notas as string | null)?.match(/Neto cobrado:\s*Bs\s*(\d+(?:\.\d+)?)/i)
      const matchDesc = (c.notas as string | null)?.match(/Desc:\s*-Bs\s*(\d+(?:\.\d+)?)/i)
      return matchNeto ? parseFloat(matchNeto[1]) : (matchDesc ? Math.max(0, Number(c.precio) - parseFloat(matchDesc[1])) : Number(c.precio || 0))
    }

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

    let totalEgresosEfectivo = 0

    txDia?.forEach((t: any) => {
      const costo = Math.abs(Number(t.costo) || 0)
      const mpLower = String(t.metodo_pago || '').toLowerCase()
      const libroTx = String(t.libro || '').toUpperCase()
      const isDigital = ['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpLower)

      const isIngreso = t.tipo_movimiento === 'INGRESO' || t.tipo_movimiento === 'VENTA_PRODUCTO' || (t.tipo_movimiento === 'DEPOSITO' && libroTx === 'BANCO')
      const isEgreso = t.tipo_movimiento === 'EGRESO' || t.tipo_movimiento === 'RETIRO'

      if (isIngreso) {
        if (libroTx === 'SERVICIOS') resumen.servicios += costo
        else if (libroTx === 'VENTAS') resumen.ventas += costo
        else if (libroTx === 'BANCO') resumen.banco += costo

        // Desglose de ingresos por método de pago
        const mEfectivo = mpLower === 'mixto'
          ? Math.max(0, Number(t.monto_efectivo || 0))
          : (mpLower === 'efectivo' ? costo : 0)
        const mQr = mpLower === 'mixto'
          ? Math.max(0, Number(t.monto_qr || 0))
          : (isDigital ? costo : 0)

        resumen.total_efectivo += mEfectivo
        resumen.total_qr += mQr
        if (mpLower === 'tarjeta') resumen.total_tarjeta += costo
      } else if (isEgreso) {
        if (libroTx === 'CAJA_CHICA') {
          resumen.caja_chica += costo
        } else if (libroTx === 'USO_TIENDA') {
          resumen.uso_tienda += costo
        }
        if (mpLower === 'efectivo' || Number(t.monto_efectivo || 0) > 0) {
          totalEgresosEfectivo += Number(t.monto_efectivo || costo)
        }
      }

      if (t.es_sancion) resumen.sanciones += costo
    })

    const citasMonto = (citasDia || []).reduce((acc, c) => acc + getCitaNeto(c), 0)
    if (resumen.servicios < citasMonto) {
      resumen.servicios = citasMonto
    }

    // Total facturado (suma de servicios y ventas)
    resumen.total_registrado = resumen.servicios + resumen.ventas

    // Traer cierre existente
    const { data: cierre } = await supabase
      .from('daily_closures')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()

    // =========================================================================
    // MÉTRICAS EXACTAS FORMATO EXCEL "ARQUEO DE CAJA" (BARBER SITE)
    // =========================================================================
    const BASE_SALDO_SISTEMA_OCT29 = 180.50
    const BASE_TOTAL_BANCO_OCT29 = 1571.94

    const total_ingreso_dia = resumen.total_efectivo
    const total_egreso_dia = totalEgresosEfectivo
    const regis_dia_sistema = total_ingreso_dia - total_egreso_dia

    const total_banco_dia = resumen.total_qr + resumen.total_tarjeta
    const diario_banco = total_banco_dia

    let saldo_apertura = BASE_SALDO_SISTEMA_OCT29
    let saldo_total_sistema = BASE_SALDO_SISTEMA_OCT29
    let total_banco_acumulado = BASE_TOTAL_BANCO_OCT29

    if (fecha > '2026-10-29') {
      saldo_apertura = BASE_SALDO_SISTEMA_OCT29
      saldo_total_sistema = BASE_SALDO_SISTEMA_OCT29 + regis_dia_sistema
      total_banco_acumulado = BASE_TOTAL_BANCO_OCT29 + diario_banco
    } else if (fecha === '2026-10-29') {
      saldo_apertura = 215.50
      saldo_total_sistema = 180.50
      total_banco_acumulado = 1571.94
    }

    const excelMetrics = {
      saldo_apertura,
      saldo_total_sistema,
      total_ingreso_dia,
      total_egreso_dia,
      regis_dia_sistema,
      total_banco_dia,
      total_egreso_banco_dia: 0,
      diario_banco,
      total_banco_acumulado,
    }

    return NextResponse.json({
      resumen: {
        ...resumen,
        excel: excelMetrics,
      },
      cierre,
      movimientos: txDia || []
    })
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
    const fecha = body.fecha || getBoliviaDateString()

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('daily_closures')
      .select('id, cerrado')
      .eq('fecha', fecha)
      .maybeSingle()

    if (existing?.cerrado) {
      return NextResponse.json({ error: 'El arqueo de este día ya fue cerrado' }, { status: 400 })
    }

    const adminSupabase = await createServerAdminClient()
    const usuarioCierre = body.usuario_cierre || profile?.full_name || user.email || 'Sistema'

    if (body.cerrado && body.pago_cierre && Number(body.pago_cierre.monto) > 0) {
      const pMonto = Number(body.pago_cierre.monto)
      const pMetodo = String(body.pago_cierre.metodo_pago || 'efectivo').toLowerCase()
      const pPersona = body.pago_cierre.persona || usuarioCierre
      const pComprobante = body.pago_cierre.comprobante_url || null
      const esDigital = ['qr', 'transferencia', 'banco', 'tarjeta'].includes(pMetodo)

      // Asegurar que EGR-CIE exista en plan_cuentas
      await adminSupabase.from('plan_cuentas').upsert({
        codigo: 'EGR-CIE',
        detalle: 'Pago por Cierre de Caja Diario',
        tipo: 'EGRESO',
        nivel: 1,
        es_sancion: false
      }, { onConflict: 'codigo', ignoreDuplicates: true })

      const { error: txError } = await adminSupabase.from('transactions').insert({
        libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
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
        monto_efectivo: esDigital ? 0 : pMonto,
        monto_qr: esDigital ? pMonto : 0,
        usuario_registro: profile?.full_name || 'Sistema',
        comprobante_url: pComprobante
      })

      if (txError) {
        console.error("Error inserting transaction pago_cierre, trying base fallback:", txError)
        await adminSupabase.from('transactions').insert({
          libro: esDigital ? 'BANCO' : 'CAJA_CHICA',
          fecha,
          ci: '0000000',
          nombre: `Pago Cierre de Caja a ${pPersona}`,
          cuenta_codigo: 'EGR-CIE',
          cuenta_detalle: 'Pago por Cierre de Caja Diario',
          glosa: `Bono por cerrar caja el día ${fecha}`,
          costo: pMonto,
          tipo_movimiento: 'EGRESO',
          es_sancion: false,
          usuario_registro: profile?.full_name || 'Sistema',
        })
      }

      const { error: egrError } = await adminSupabase.from('egresos').insert({
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
        monto_efectivo: esDigital ? 0 : pMonto,
        monto_qr: esDigital ? pMonto : 0,
        usuario_registro: profile?.full_name || 'Sistema',
        notas: `Bono por cerrar caja el día ${fecha}`
      })

      if (egrError) {
        if (egrError.code === '42703' || (egrError as any).code === 'PGRST204' || egrError.message?.includes('column') || egrError.message?.includes('schema cache')) {
          await adminSupabase.from('egresos').insert({
            fecha,
            concepto: 'Pago por Cierre de Caja Diario',
            proveedor: pPersona,
            monto_bruto: pMonto,
            tiene_factura: false,
            iva: 0,
            it: 0,
            monto_neto: pMonto,
            cuenta_codigo: 'EGR-CIE',
            usuario_registro: profile?.full_name || 'Sistema',
            notas: `Bono por cerrar caja el día ${fecha}`
          })
        }
      }
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
      const { data, error } = await adminSupabase
        .from('daily_closures')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      const { data, error } = await adminSupabase
        .from('daily_closures')
        .insert(row)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
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
