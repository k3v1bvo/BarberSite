import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

/**
 * Envía recordatorios para citas en las próximas 24h.
 * Proteger con CRON_SECRET en producción (Vercel Cron / cron-job.org).
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET

  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const serverDb = await createServerSupabaseClient()
  const db = getNotificationDbClient(serverDb)

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { data: citas, error } = await db
    .from('citas')
    .select('id, barbero_id, fecha_hora, estado, clientes(nombre, email), servicios(nombre)')
    .gte('fecha_hora', now.toISOString())
    .lte('fecha_hora', in24h.toISOString())
    .in('estado', ['pendiente', 'confirmado'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let enviados = 0

  for (const cita of citas || []) {
    const { data: yaEnviado } = await db
      .from('notificaciones')
      .select('id')
      .eq('categoria', 'recordatorio')
      .contains('metadata', { cita_id: cita.id })
      .limit(1)

    if (yaEnviado?.length) continue

    const fh = new Date(cita.fecha_hora)
    const cliente = cita.clientes as { nombre?: string; email?: string } | null
    const servicio = cita.servicios as { nombre?: string } | null

    const { data: barbero } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', cita.barbero_id)
      .maybeSingle()

    await dispatchNotification(db, {
      event: 'recordatorio',
      payload: {
        citaId: cita.id,
        barberoId: cita.barbero_id,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email ?? undefined,
        barberoNombre: barbero?.full_name,
        servicioNombre: servicio?.nombre,
        fecha: fh.toLocaleDateString('es-BO'),
        hora: fh.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      },
    })
    enviados++
  }

  return NextResponse.json({ success: true, enviados, total: citas?.length || 0 })
}
