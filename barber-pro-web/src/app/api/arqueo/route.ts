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

    const fecha = request.nextUrl.searchParams.get('fecha') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const dObj = new Date(`${fecha}T12:00:00Z`)
    const nextObj = new Date(dObj.getTime() + 86400000)
    const nextDayStr = nextObj.toISOString().split('T')[0]

    // Auto-reparar registros guardados con fecha UTC errónea en este día boliviano
    await supabase
      .from('transactions')
      .update({ fecha })
      .gte('creado_en', `${fecha}T04:00:00Z`)
      .lte('creado_en', `${nextDayStr}T03:59:59Z`)
      .neq('fecha', fecha)

    const { data: txDia } = await supabase
      .from('transactions')
      .select('libro, costo, metodo_pago, es_sancion, tipo_movimiento, monto_efectivo, monto_qr')
      .eq('fecha', fecha)

    const { data: citasDia } = await supabase
      .from('citas')
      .select('id, precio, anticipo_monto, metodo_pago, barbero_id, cliente_id')
      .gte('fecha_hora', `${fecha}T00:00:00`)
      .lte('fecha_hora', `${fecha}T23:59:59`)
      .eq('estado', 'completado')

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

    const row = {
      fecha,
      caja_chica: body.caja_chica || 0,
      ventas: body.ventas || 0,
      servicios: body.servicios || 0,
      banco: body.banco || 0,
      total_efectivo_fisico: body.total_efectivo_fisico || 0,
      total_qr: body.total_qr || 0,
      observaciones: body.observaciones || null,
      usuario_cierre: profile?.full_name || user.email || 'Sistema',
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
