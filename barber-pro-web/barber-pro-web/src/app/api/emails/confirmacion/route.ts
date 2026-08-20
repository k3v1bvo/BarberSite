import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

/** @deprecated Usar POST /api/notificaciones/dispatch — mantiene compatibilidad con reservar */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const serverDb = await createServerSupabaseClient()
    const db = getNotificationDbClient(serverDb)

    await dispatchNotification(db, {
      event: 'reserva_nueva',
      allowPublic: true,
      payload: {
        clienteNombre: body.nombreCliente,
        clienteEmail: body.email,
        servicioNombre: body.servicio,
        fecha: body.fecha,
        hora: body.hora,
        barberoNombre: body.nombreBarbero,
        barberoEmail: body.emailBarbero,
        barberoId: body.barberoId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error enviando email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}
