import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/auth/api-guards'
import { sanitizeAmount } from '@/lib/validators'

export async function GET() {
  const auth = await requireRole(['admin', 'barbero'])
  if ('error' in auth) return auth.error

  const { supabase, user, role } = auth
  const barberoId = role === 'barbero' ? user.id : null

  let query = supabase
    .from('comisiones_pagos')
    .select('*, barbero:profiles!barbero_id(full_name), admin:profiles!admin_id(full_name)')
    .order('pagado_at', { ascending: false })
    .limit(50)

  if (barberoId) query = query.eq('barbero_id', barberoId)

  const { data, error } = await query
  if (error?.code === '42P01') {
    return NextResponse.json({ pagos: [], aviso: 'Ejecuta supabase_modulos_completos.sql' })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pagos: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = await request.json()
  const { barbero_id, cita_ids, periodo_tipo, fecha_inicio, fecha_fin, metodo_pago, notas } = body

  let citasQuery = supabase
    .from('citas')
    .select('id, comision_barbero')
    .eq('barbero_id', barbero_id)
    .eq('estado', 'completado')
    .eq('comision_pagada', false)

  if (cita_ids?.length) {
    citasQuery = citasQuery.in('id', cita_ids)
  } else {
    citasQuery = citasQuery
      .gte('fecha_hora', `${fecha_inicio}T00:00:00`)
      .lte('fecha_hora', `${fecha_fin}T23:59:59`)
  }

  const { data: citas, error: citasError } = await citasQuery
  if (citasError) return NextResponse.json({ error: citasError.message }, { status: 500 })
  if (!citas?.length) return NextResponse.json({ error: 'No hay comisiones pendientes' }, { status: 400 })

  const montoTotal = citas.reduce((s, c) => s + (c.comision_barbero || 0), 0)

  const { data: pago, error: pagoError } = await supabase
    .from('comisiones_pagos')
    .insert({
      barbero_id,
      periodo_tipo: periodo_tipo || 'personalizado',
      fecha_inicio,
      fecha_fin,
      monto_total: montoTotal,
      metodo_pago,
      notas,
      admin_id: user.id,
    })
    .select()
    .single()

  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 500 })

  await supabase
    .from('citas')
    .update({ comision_pagada: true, comision_pago_id: pago.id })
    .in('id', citas.map((c) => c.id))

  return NextResponse.json({ pago, citas_pagadas: citas.length })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const { cita_id, comision_barbero, motivo } = await request.json()
  
  const comisionNueva = sanitizeAmount(comision_barbero)
  if (comisionNueva === null) {
      return NextResponse.json({ error: 'Monto de comisión inválido' }, { status: 400 })
  }

  // 1. Obtener comisión actual para la auditoría
  const { data: cita } = await supabase
    .from('citas')
    .select('comision_barbero')
    .eq('id', cita_id)
    .single()

  // 2. Registrar en auditoría
  await supabase.from('comisiones_audit').insert({
      cita_id,
      admin_id: user.id,
      comision_anterior: cita?.comision_barbero,
      comision_nueva: comisionNueva,
      motivo: motivo || 'Ajuste manual'
  })

  // 3. Actualizar la cita
  const { error } = await supabase
    .from('citas')
    .update({ comision_barbero: comisionNueva })
    .eq('id', cita_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
