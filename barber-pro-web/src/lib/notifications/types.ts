export type NotificationCategory =
  | 'reserva_nueva'
  | 'reserva_cancelada'
  | 'reserva_reprogramada'
  | 'venta_nueva'
  | 'cita_completada'
  | 'horario_cambio'
  | 'asistencia'
  | 'recordatorio'
  | 'sistema'
  | 'pago_pendiente'
  | 'pago_verificado'
  | 'invitacion_2x1'
  | 'invitacion_referido'

export type NotificationTipo = 'info' | 'success' | 'warning' | 'danger'

export interface NotificationPayload {
  citaId?: string
  pedidoId?: string
  barberoId?: string
  clienteId?: string
  clienteNombre?: string
  clienteEmail?: string
  acompananteNombre?: string
  montoBono?: string
  barberoNombre?: string
  barberoEmail?: string
  acompananteEmail?: string
  servicioNombre?: string
  fecha?: string
  hora?: string
  fechaAnterior?: string
  horaAnterior?: string
  monto?: number
  motivo?: string
  link?: string
  comprobante_url?: string
  [key: string]: string | number | undefined
}

export interface DispatchInput {
  event: NotificationCategory
  payload: NotificationPayload
  /** Permite disparo desde reserva pública sin sesión */
  allowPublic?: boolean
  userEmail?: string
}

export interface InAppNotificationInsert {
  user_id?: string | null
  rol_destino?: string | null
  titulo: string
  mensaje: string
  tipo: NotificationTipo
  categoria: NotificationCategory
  link?: string | null
  metadata?: Record<string, unknown>
}

export interface NotificationPreferences {
  user_id: string
  email_reservas: boolean
  email_ventas: boolean
  email_recordatorios: boolean
  email_alertas: boolean
  push_reservas: boolean
  push_ventas: boolean
  push_alertas: boolean
  push_recordatorios: boolean
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  email_reservas: true,
  email_ventas: true,
  email_recordatorios: true,
  email_alertas: true,
  push_reservas: true,
  push_ventas: true,
  push_alertas: true,
  push_recordatorios: true,
}
