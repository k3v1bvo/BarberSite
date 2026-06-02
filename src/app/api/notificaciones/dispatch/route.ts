import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import type { DispatchInput, NotificationCategory } from '@/lib/notifications/types'

const PUBLIC_EVENTS: NotificationCategory[] = ['reserva_nueva']

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DispatchInput
    const serverDb = await createServerSupabaseClient()
    const {
      data: { user },
    } = await serverDb.auth.getUser()

    const isPublic = body.allowPublic && PUBLIC_EVENTS.includes(body.event)

    if (!user && !isPublic) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const db = getNotificationDbClient(serverDb)
    const result = await dispatchNotification(db, body)

    return NextResponse.json(result)
  } catch (e) {
    console.error('[api/notificaciones/dispatch]', e)
    return NextResponse.json({ error: 'Error al procesar notificación' }, { status: 500 })
  }
}
