import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBoliviaDateString, getBusinessNow } from '@/lib/asistencia/helpers'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const barbero_id = searchParams.get('barbero_id')
  const estado = searchParams.get('estado')

  let query = supabase
    .from('citas')
    .select('*, barbero:profiles!citas_barbero_id_fkey(full_name), servicios(nombre), clientes(nombre)')
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
    const { data: txAdelantos } = await supabase
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

    const { data: sanciones } = await supabase
      .from('sanciones')
      .select('*')
      .eq('barbero_id', barbero_id)
      .eq('estado', 'pendiente')

    if (sanciones) {
      sanciones_pendientes = sanciones
      total_sanciones = sanciones_pendientes.reduce((sum, s) => sum + Number(s.monto), 0)
    }

    const { data: pendingBonos } = await supabase
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

  const now = getBusinessNow()
  const todayStr = getBoliviaDateString()
  
  const dow = now.getUTCDay()
  const startOfWeek = new Date(now.getTime())
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dow)
  const startOfWeekStr = `${startOfWeek.getUTCFullYear()}-${String(startOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getUTCDate()).padStart(2, '0')}`

  citas?.forEach(c => {
    const comision = Number(c.comision_barbero) || 0
    if (c.comision_pagada) {
      pagado += comision
    } else {
      pendiente += comision
    }

    const dateStr = c.fecha_hora.slice(0, 10)
    if (dateStr === todayStr) {
      hoy += comision
    }
    if (dateStr >= startOfWeekStr) {
      semana += comision
    }
  })

  return NextResponse.json({ 
    citas, 
    resumen: { pendiente, pagado, hoy, semana },
    finanzas: {
      saldo_adelantos,
      sanciones_pendientes,
      total_sanciones,
      bonos_pendientes,
      total_bonos
    }
  })
}
