import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getBusinessDateString } from '@/lib/asistencia/helpers'

/** POST: Notificar a admins/coordinadores que un barbero excedió su tiempo de almuerzo.
 *  Idempotente — solo notifica una vez por barbero por día. */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const db = getNotificationDbClient(supabase)
    const hoy = getBusinessDateString()

    // Verificar que el barbero realmente sigue en almuerzo
    const { data: asistencia } = await db
      .from('asistencias')
      .select('id, en_almuerzo')
      .eq('profile_id', user.id)
      .eq('fecha', hoy)
      .is('hora_salida', null)
      .maybeSingle()

    if (!asistencia?.en_almuerzo) {
      return NextResponse.json({ skipped: true, mensaje: 'Barbero ya no está en almuerzo' })
    }

    // Verificar idempotencia — buscar si ya se notificó hoy para este barbero
    const inicioDia = `${hoy}T00:00:00-04:00`
    const finDia = `${hoy}T23:59:59-04:00`

    const { data: yaNotificado } = await db
      .from('notificaciones')
      .select('id')
      .ilike('titulo', `%excedió%almuerzo%`)
      .gte('created_at', inicioDia)
      .lte('created_at', finDia)
      .limit(1)

    if (yaNotificado && yaNotificado.length > 0) {
      return NextResponse.json({ skipped: true, mensaje: 'Ya se notificó exceso de almuerzo hoy' })
    }

    // Obtener nombre del barbero
    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const barberoNombre = profile?.full_name || 'Barbero'

    // Obtener admins y coordinadores
    const { data: admins } = await db
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['admin', 'coordinador'])

    if (admins && admins.length > 0) {
      const ahora = new Date()
      const horaActualStr = ahora.toLocaleTimeString('es-BO', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
      })

      // 1. Notificaciones por Sistema en BD
      const notifPayloads = admins.map(a => ({
        user_id: a.id,
        titulo: `⚠️ ${barberoNombre} excedió su almuerzo`,
        mensaje: `El colaborador ${barberoNombre} ha excedido su tiempo de almuerzo y aún no ha marcado su regreso (${horaActualStr}). El tiempo sigue corriendo como descanso.`,
        tipo: 'asistencia',
        leido: false,
      }))

      try {
        await db.from('notificaciones').insert(notifPayloads)
      } catch {
        /* silencioso si no existe tabla */
      }

      // 2. Notificaciones por Email
      try {
        const { sendEmail } = await import('@/lib/notifications/email')
        for (const admin of admins) {
          if (admin.email) {
            sendEmail({
              to: admin.email,
              subject: `⚠️ Almuerzo Excedido: ${barberoNombre}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #18181b; color: #ffffff; border-radius: 12px; max-width: 500px; margin: 0 auto;">
                  <h2 style="color: #ef4444; margin-top: 0;">⚠️ Almuerzo Excedido</h2>
                  <p>El colaborador <strong>${barberoNombre}</strong> ha excedido su tiempo de almuerzo y <strong>aún no ha marcado su regreso</strong>.</p>
                  <div style="background-color: #27272a; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong>👤 Barbero:</strong> ${barberoNombre}</p>
                    <p style="margin: 5px 0;"><strong>⏰ Hora actual:</strong> ${horaActualStr}</p>
                    <p style="margin: 5px 0;"><strong>📋 Estado:</strong> Sigue en descanso</p>
                  </div>
                  <p style="color: #fbbf24; font-weight: bold;">El tiempo sigue contando como descanso hasta que marque su regreso manualmente.</p>
                  <p style="font-size: 11px; color: #a1a1aa;">Notificación automática del control de asistencia de BarberSite.</p>
                </div>
              `,
            }).catch(() => {})
          }
        }
      } catch {
        /* silencioso */
      }
    }

    return NextResponse.json({ ok: true, mensaje: `Se notificó a admins que ${barberoNombre} excedió su almuerzo` })
  } catch (err: any) {
    console.error('POST asistencias/almuerzo/excedido:', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
