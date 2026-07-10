import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('comisiones_pagos')
    .select('*, barbero:profiles!comisiones_pagos_barbero_id_fkey(full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pagos: data })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await req.json()
  const { barbero_id, periodo_tipo, fecha_inicio, fecha_fin, metodo_pago, descuento_adelanto = 0, sanciones_ids = [], bonos_ids = [], comprobante_url } = body

  if (!barbero_id || !fecha_inicio || !fecha_fin) {
    return NextResponse.json({ error: 'Datos requeridos faltantes' }, { status: 400 })
  }

  // Find pending appointments for this barber within the dates
  const { data: citas, error: citasError } = await supabase
    .from('citas')
    .select('id, comision_barbero')
    .eq('barbero_id', barbero_id)
    .eq('estado', 'completado')
    .eq('comision_pagada', false)
    .gte('fecha_hora', fecha_inicio)
    // Add 1 day to fecha_fin to make it inclusive up to the end of the day if it's just a date
    .lte('fecha_hora', `${fecha_fin}T23:59:59`)

  if (citasError) {
    return NextResponse.json({ error: citasError.message }, { status: 500 })
  }

  if (!citas || citas.length === 0) {
    return NextResponse.json({ error: 'No hay comisiones pendientes para este barbero en el periodo seleccionado' }, { status: 400 })
  }

  // Calculate base commission
  const comision_bruta = citas.reduce((sum, cita) => sum + (Number(cita.comision_barbero) || 0), 0)
  
  // Calculate total additions and deductions
  let total_sanciones = 0
  if (sanciones_ids.length > 0) {
    const { data: sanciones } = await supabase
      .from('sanciones')
      .select('monto')
      .in('id', sanciones_ids)
    if (sanciones) {
      total_sanciones = sanciones.reduce((sum, s) => sum + Number(s.monto), 0)
    }
  }

  let total_bonos = 0
  if (bonos_ids.length > 0) {
    const { data: bonos } = await supabase
      .from('bonos')
      .select('monto')
      .in('id', bonos_ids)
    if (bonos) {
      total_bonos = bonos.reduce((sum, b) => sum + Number(b.monto), 0)
    }
  }

  const monto_total = comision_bruta - total_sanciones + total_bonos - Number(descuento_adelanto)
  const currentUserId = (await supabase.auth.getUser()).data.user?.id
  
  // Try to create the payment record
  const { data: pago, error: pagoError } = await supabase
    .from('comisiones_pagos')
    .insert([{
      barbero_id,
      monto_total,
      periodo_tipo,
      fecha_inicio,
      fecha_fin,
      metodo_pago,
      admin_id: currentUserId,
      notas: `Pago Comisiones. Adelanto descontado: ${descuento_adelanto}. Sanciones: ${total_sanciones}. Bonos: ${total_bonos}.`
    }])
    .select()
    .single()

  if (pagoError) {
    return NextResponse.json({ error: pagoError.message }, { status: 500 })
  }

  // Update citas to mark as paid
  const citaIds = citas.map(c => c.id)
  const { error: updateError } = await supabase
    .from('citas')
    .update({ 
      comision_pagada: true,
      comision_pago_id: pago.id 
    })
    .in('id', citaIds)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Handle Adelanto Deduction
  if (descuento_adelanto > 0) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single()
    await supabase.from('transactions').insert({
      libro: metodo_pago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
      fecha: new Date().toISOString().split('T')[0],
      ci: '0000000',
      nombre: 'Devolución Adelanto (vía Comisión)',
      cuenta_codigo: 'ACT-001',
      cuenta_detalle: 'Adelantos a Personal',
      glosa: `Devolución descontada de comisión (Pago ${pago.id})`,
      costo: descuento_adelanto,
      tipo_movimiento: 'INGRESO',
      es_sancion: false,
      empleado_id: barbero_id,
      metodo_pago: metodo_pago,
      usuario_registro: profile?.full_name || 'Sistema',
    })
  }

  // Mark Sanciones as paid
  if (sanciones_ids.length > 0) {
    const { error: sancionError } = await supabase
      .from('sanciones')
      .update({ estado: 'aplicada', aplicada_en_pago_id: pago.id })
      .in('id', sanciones_ids)

    if (sanciones_ids.length > 0) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single()
      await supabase.from('transactions').insert({
        libro: metodo_pago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
        fecha: new Date().toISOString().split('T')[0],
        ci: '0000000',
        nombre: 'Sanciones aplicadas (vía Comisión)',
        cuenta_codigo: 'ING-001', // Example generic income code
        cuenta_detalle: 'Ingresos Varios',
        glosa: `Sanciones descontadas de comisión (Pago ${pago.id})`,
        costo: total_sanciones,
        tipo_movimiento: 'INGRESO',
        es_sancion: true,
        empleado_id: barbero_id,
        metodo_pago: metodo_pago,
        usuario_registro: profile?.full_name || 'Sistema',
      })
    }
  }

  // Mark Bonos as paid
  if (bonos_ids.length > 0) {
    await supabase.from('bonos')
      .update({ pagado: true, pagado_at: new Date().toISOString() })
      .in('id', bonos_ids)
  }

  // Insertar EGRESO en la caja por el pago de comisiones
  const { data: adminProfile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single()
  const { data: barberoProfile } = await supabase.from('profiles').select('full_name').eq('id', barbero_id).single()
  
  if (monto_total > 0) {
    const fechaActual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const { error: egresoError } = await supabase.from('transactions').insert({
      libro: metodo_pago === 'efectivo' ? 'CAJA_CHICA' : 'BANCO',
      fecha: fechaActual,
      ci: '0000000',
      nombre: `Pago Comisiones a ${barberoProfile?.full_name || 'Barbero'}`,
      cuenta_codigo: 'EGR-COM',
      cuenta_detalle: 'Pago de Comisiones / Sueldos',
      glosa: `Pago ${periodo_tipo} del ${fecha_inicio} al ${fecha_fin}. (Pago ID: ${pago.id})`,
      costo: monto_total,
      tipo_movimiento: 'EGRESO',
      es_sancion: false,
      empleado_id: barbero_id,
      metodo_pago: metodo_pago,
      subcategoria: 'COMISION_PAGO',
      monto_efectivo: metodo_pago === 'efectivo' ? monto_total : (metodo_pago === 'mixto' ? Number(body.monto_efectivo) || 0 : 0),
      monto_qr: metodo_pago === 'qr' ? monto_total : (metodo_pago === 'mixto' ? Number(body.monto_qr) || 0 : 0),
      usuario_registro: adminProfile?.full_name || 'Sistema',
      comprobante_url: comprobante_url || null,
    })

    if (egresoError) {
      console.error("Error al registrar egreso de comisión en caja:", egresoError)
    }

    // También registrar explícitamente en la tabla de egresos
    const { error: egrTablaError } = await supabase.from('egresos').insert({
      fecha: fechaActual,
      concepto: `Pago de Comisiones / Sueldo (${periodo_tipo})`,
      proveedor: barberoProfile?.full_name || 'Barbero',
      monto_bruto: monto_total,
      tiene_factura: false,
      iva: 0,
      it: 0,
      monto_neto: monto_total,
      cuenta_codigo: 'EGR-COM',
      metodo_pago: metodo_pago || 'efectivo',
      monto_efectivo: metodo_pago === 'efectivo' ? monto_total : (metodo_pago === 'mixto' ? Number(body.monto_efectivo) || 0 : 0),
      monto_qr: metodo_pago === 'qr' ? monto_total : (metodo_pago === 'mixto' ? Number(body.monto_qr) || 0 : 0),
      usuario_registro: adminProfile?.full_name || 'Sistema',
      notas: `Pago ${periodo_tipo} del ${fecha_inicio} al ${fecha_fin}. (Pago ID: ${pago.id})`,
    })

    if (egrTablaError) {
      console.error("Error al registrar egreso en tabla egresos:", egrTablaError)
    }
  }

  return NextResponse.json({ success: true, pago })
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await req.json()
  const { cita_id, comision_barbero } = body

  if (!cita_id || typeof comision_barbero !== 'number') {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('citas')
    .update({ comision_barbero })
    .eq('id', cita_id)
    .eq('comision_pagada', false) // Only allow editing unpaid commissions

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
