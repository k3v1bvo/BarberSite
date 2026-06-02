import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-guards'
import { sanitizeSearchFilter } from '@/lib/validators'

export async function GET(request: Request) {
  const auth = await requireRole(['admin', 'barbero', 'recepcionista'])
  if ('error' in auth) return auth.error
  const { supabase, user, role } = auth

  const url = new URL(request.url)
  const barberoIdParam = url.searchParams.get('barbero_id')
  const estado = sanitizeSearchFilter(url.searchParams.get('estado') || 'pendiente')
  const desde = sanitizeSearchFilter(url.searchParams.get('desde') || '')
  const hasta = sanitizeSearchFilter(url.searchParams.get('hasta') || '')

  const targetBarbero = role === 'barbero' ? user.id : barberoIdParam

  let query = supabase
    .from('citas')
    .select(`
      id, fecha_hora, precio, comision_barbero, comision_pagada, comision_pago_id,
      propinas, estado, finished_at,
      servicios(nombre),
      clientes(nombre),
      barbero:profiles!barbero_id(id, full_name)
    `)
    .eq('estado', 'completado')
    .order('fecha_hora', { ascending: false })

  if (targetBarbero) query = query.eq('barbero_id', targetBarbero)
  if (estado === 'pendiente') query = query.eq('comision_pagada', false)
  if (estado === 'pagada') query = query.eq('comision_pagada', true)
  if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`)
  if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`)

  const { data: citas, error } = await query.limit(200)
  if (error?.code === '42703') {
    return NextResponse.json({ citas: [], aviso: 'Ejecuta supabase_modulos_completos.sql' })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pendiente = (citas ?? []).filter((c) => !c.comision_pagada).reduce((s, c) => s + (c.comision_barbero || 0), 0)
  const pagado = (citas ?? []).filter((c) => c.comision_pagada).reduce((s, c) => s + (c.comision_barbero || 0), 0)

  const hoy = new Date().toISOString().slice(0, 10)
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const semanaDesde = inicioSemana.toISOString().slice(0, 10)

  const hoyTotal = (citas ?? [])
    .filter((c) => c.fecha_hora?.startsWith(hoy) && !c.comision_pagada)
    .reduce((s, c) => s + (c.comision_barbero || 0), 0)

  const semanaTotal = (citas ?? [])
    .filter((c) => c.fecha_hora >= `${semanaDesde}T00:00:00` && !c.comision_pagada)
    .reduce((s, c) => s + (c.comision_barbero || 0), 0)

  return NextResponse.json({
    citas: citas ?? [],
    resumen: { pendiente, pagado, hoy: hoyTotal, semana: semanaTotal },
  })
}
