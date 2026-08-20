import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import type { NotificationCategory } from '@/lib/notifications/types'

/** Compatibilidad: POST { tipo, datos } → dispatch unificado */
export async function POST(request: Request) {
  try {
    const { tipo, datos } = await request.json()
    const serverDb = await createServerSupabaseClient()
    const db = getNotificationDbClient(serverDb)

    const map: Record<string, NotificationCategory> = {
      nueva_reserva: 'reserva_nueva',
      cancelacion: 'reserva_cancelada',
      venta: 'venta_nueva',
    }

    const event = map[tipo] || 'sistema'
    await dispatchNotification(db, {
      event,
      allowPublic: event === 'reserva_nueva',
      payload: {
        barberoId: datos?.barbero_id,
        clienteNombre: datos?.cliente_nombre,
        clienteEmail: datos?.cliente_email,
        servicioNombre: datos?.servicio,
        fecha: datos?.fecha,
        hora: datos?.hora,
        monto: datos?.total,
        pedidoId: datos?.pedido_id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notificaciones/email]', error)
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
  }
}
