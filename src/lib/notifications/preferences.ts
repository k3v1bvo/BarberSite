import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PREFERENCES,
  type NotificationCategory,
  type NotificationPreferences,
} from './types'

export async function getUserPreferences(
  db: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  const { data } = await db
    .from('notificacion_preferencias')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return { user_id: userId, ...DEFAULT_PREFERENCES }
  }
  return data as NotificationPreferences
}

export function shouldSendEmail(
  prefs: NotificationPreferences,
  category: NotificationCategory
): boolean {
  switch (category) {
    case 'reserva_nueva':
    case 'reserva_cancelada':
    case 'reserva_reprogramada':
      return prefs.email_reservas
    case 'venta_nueva':
      return prefs.email_ventas
    case 'recordatorio':
      return prefs.email_recordatorios
    case 'asistencia':
    case 'horario_cambio':
    case 'sistema':
    case 'cita_completada':
      return prefs.email_alertas
    default:
      return prefs.email_alertas
  }
}

export function shouldSendPush(
  prefs: NotificationPreferences,
  category: NotificationCategory
): boolean {
  switch (category) {
    case 'reserva_nueva':
    case 'reserva_cancelada':
    case 'reserva_reprogramada':
      return prefs.push_reservas
    case 'venta_nueva':
      return prefs.push_ventas
    case 'recordatorio':
      return prefs.push_recordatorios
  }
  return prefs.push_alertas
}
