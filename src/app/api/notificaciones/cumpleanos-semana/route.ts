import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { getBusinessNow } from '@/lib/asistencia/helpers'

export async function GET(request: NextRequest) {
  try {
    const serverDb = await createServerSupabaseClient()
    const db = getNotificationDbClient(serverDb)

    const today = getBusinessNow()
    const targetDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const targetMonth = targetDate.getUTCMonth() + 1
    const targetDay = targetDate.getUTCDate()

    const { data: clientes, error } = await db
      .from('clientes')
      .select('id, nombre, email, cumpleanos')
      .not('cumpleanos', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let enviados = 0

    for (const c of clientes || []) {
      if (!c.cumpleanos) continue
      const parts = String(c.cumpleanos).split('T')[0].split('-')
      if (parts.length < 3) continue

      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)

      if (month === targetMonth && day === targetDay) {
        // Verificar si ya se le envió notificación esta semana
        const { data: yaEnviado } = await db
          .from('notificaciones')
          .select('id')
          .eq('categoria', 'cumpleanos_semana_antes')
          .eq('usuario_id', c.id)
          .gte('creado_en', new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1)

        if (yaEnviado && yaEnviado.length > 0) continue

        await dispatchNotification(db, {
          event: 'cumpleanos_semana_antes',
          payload: {
            clienteId: c.id,
            clienteNombre: c.nombre || 'Cliente',
            clienteEmail: c.email || undefined,
            fecha: `${day}/${month}`,
          },
          userEmail: c.email || undefined,
        })
        enviados++
      }
    }

    return NextResponse.json({
      success: true,
      enviados,
      targetFecha: `${targetDay}/${targetMonth}`,
      message: `Enviadas ${enviados} notificaciones de cumpleaños próximo.`
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
