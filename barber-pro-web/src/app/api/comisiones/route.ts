import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { getBoliviaDateString, getBusinessNow } from '@/lib/asistencia/helpers'
import { getBoliviaDateKey } from '@/lib/agenda/date-utils'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const adminSupabase = await createServerAdminClient()
  const { searchParams } = new URL(req.url)
  const barbero_id = searchParams.get('barbero_id')
  const estado = searchParams.get('estado')
  const fecha_inicio = searchParams.get('fecha_inicio')
  const fecha_fin = searchParams.get('fecha_fin')

  let query = adminSupabase
    .from('citas')
    .select('*, barbero:profiles!citas_barbero_id_fkey(full_name, comision_porcentaje), servicios(nombre, precio, comision_tipo, comision_valor), clientes(nombre)')
    .eq('estado', 'completado')
    .order('fecha_hora', { ascending: false })

  if (barbero_id) {
    query = query.eq('barbero_id', barbero_id)
  }

  if (estado === 'pendiente') {
    query = query.eq('comision_pagada', false)
  } else if (estado === 'pagada') {
    query = query.eq('comision_pagada', true)
  }
  // If 'todas', don't filter by comision_pagada

  if (fecha_inicio) {
    query = query.gte('fecha_hora', fecha_inicio.includes('T') ? fecha_inicio : `${fecha_inicio}T00:00:00-04:00`)
  }
  if (fecha_fin) {
    query = query.lte('fecha_hora', fecha_fin.includes('T') ? fecha_fin : `${fecha_fin}T23:59:59-04:00`)
  }

  const { data: citas, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch Adelantos balance
  let saldo_adelantos = 0
  let sanciones_pendientes: any[] = []
  let total_sanciones = 0
  let bonos_pendientes: any[] = []
  let total_bonos = 0

  if (barbero_id) {
    const { data: txAdelantos } = await adminSupabase
      .from('transactions')
      .select('costo, tipo_movimiento, cuenta_codigo')
      .eq('empleado_id', barbero_id)

    txAdelantos?.forEach(tx => {
      // Si fue un adelanto otorgado
      if (tx.tipo_movimiento === 'ADELANTO') {
        saldo_adelantos += Number(tx.costo)
      }
      // Si fue una devolución de adelanto (al pagar comisión)
      else if (tx.tipo_movimiento === 'INGRESO' && tx.cuenta_codigo === 'ACT-001') {
        saldo_adelantos -= Number(tx.costo)
      }
    })

    const { data: sanciones, error: sErr } = await adminSupabase
      .from('sanciones')
      .select('*')
      .eq('barbero_id', barbero_id)
      .eq('estado', 'pendiente')

    if (!sErr && sanciones) {
      sanciones_pendientes = sanciones
      total_sanciones = sanciones_pendientes.reduce((sum, s) => sum + Number(s.monto), 0)
    } else {
      // Fallback a transactions para sanciones pendientes
      const { data: txSanciones } = await adminSupabase
        .from('transactions')
        .select('*')
        .eq('empleado_id', barbero_id)
        .eq('es_sancion', true)
        .eq('metodo_pago', 'descuento_caja')
      if (txSanciones) {
        sanciones_pendientes = txSanciones.map((tx: any) => ({
          id: tx.id,
          tipo: tx.cuenta_detalle || 'Sanción',
          descripcion: tx.glosa || '',
          monto: Number(tx.costo) || 0,
          estado: 'pendiente'
        }))
        total_sanciones = sanciones_pendientes.reduce((sum, s) => sum + Number(s.monto), 0)
      }
    }

    const { data: pendingBonos } = await adminSupabase
      .from('bonos')
      .select('*')
      .eq('barbero_id', barbero_id)
      .eq('pagado', false)

    bonos_pendientes = pendingBonos || []
    total_bonos = bonos_pendientes.reduce((sum, b) => sum + Number(b.monto), 0)
  }

  // Calculate Resumen
  let pendiente = 0
  let pagado = 0
  let hoy = 0
  let semana = 0
  let total_cobrado = 0
  let total_cobrado_pendiente = 0

  const now = getBusinessNow()
  const todayStr = getBoliviaDateString()
  
  const dow = now.getUTCDay()
  const startOfWeek = new Date(now.getTime())
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dow)
  const startOfWeekStr = `${startOfWeek.getUTCFullYear()}-${String(startOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getUTCDate()).padStart(2, '0')}`

  citas?.forEach(c => {
    const comision = Number(c.comision_barbero) || 0
    const precio = Number(c.precio) || 0
    total_cobrado += precio

    if (c.comision_pagada) {
      pagado += comision
    } else {
      pendiente += comision
      total_cobrado_pendiente += precio
    }

    const dateStr = getBoliviaDateKey(c.fecha_hora)
    if (dateStr === todayStr) {
      hoy += comision
    }
    if (dateStr >= startOfWeekStr) {
      semana += comision
    }
  })

  // Resumen de rendimiento para todos los especialistas (respetando fechas del filtro si se especifican)
  const { data: activeProfiles } = await adminSupabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, comision_porcentaje')
    .in('role', ['barbero', 'coordinador'])
    .eq('is_active', true)
    .order('full_name')

  let citasRendimientoQuery = adminSupabase
    .from('citas')
    .select('id, barbero_id, precio, comision_barbero, comision_pagada, fecha_hora')
    .eq('estado', 'completado')
    .order('fecha_hora', { ascending: false })

  if (fecha_inicio) {
    citasRendimientoQuery = citasRendimientoQuery.gte('fecha_hora', fecha_inicio.includes('T') ? fecha_inicio : `${fecha_inicio}T00:00:00-04:00`)
  }
  if (fecha_fin) {
    citasRendimientoQuery = citasRendimientoQuery.lte('fecha_hora', fecha_fin.includes('T') ? fecha_fin : `${fecha_fin}T23:59:59-04:00`)
  } else if (!fecha_inicio) {
    // Si no hay filtro de fecha (ej. 'todas'), limitar al 2026 para no arrastrar miles de citas archivadas del 2022-2025
    citasRendimientoQuery = citasRendimientoQuery.gte('fecha_hora', '2026-01-01T00:00:00Z').limit(1000)
  }

  const { data: allActiveCitas } = await citasRendimientoQuery

  const rendimiento_barberos = (activeProfiles || []).map(b => {
    const citasB = (allActiveCitas || []).filter(c => c.barbero_id === b.id)
    const cobradoTotal = citasB.reduce((sum, c) => sum + (Number(c.precio) || 0), 0)
    const comisionTotal = citasB.reduce((sum, c) => sum + (Number(c.comision_barbero) || 0), 0)
    const pendientes = citasB.filter(c => !c.comision_pagada)
    const cobradoPendiente = pendientes.reduce((sum, c) => sum + (Number(c.precio) || 0), 0)
    const comisionPendiente = pendientes.reduce((sum, c) => sum + (Number(c.comision_barbero) || 0), 0)
    const pctEfectivo = cobradoTotal > 0 ? Math.round((comisionTotal / cobradoTotal) * 100) : (b.comision_porcentaje || 45)

    return {
      barbero: b,
      totalCitas: citasB.length,
      citasPendientes: pendientes.length,
      cobrado: cobradoTotal,
      cobradoPendiente,
      comisionTotal,
      comisionPendiente,
      pctEfectivo,
    }
  })

  return NextResponse.json({ 
    citas, 
    resumen: { pendiente, pagado, hoy, semana, total_cobrado, total_cobrado_pendiente },
    rendimiento_barberos,
    finanzas: {
      saldo_adelantos,
      sanciones_pendientes,
      total_sanciones,
      bonos_pendientes,
      total_bonos
    }
  })
}
