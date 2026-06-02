/** Hora local del negocio (Cochabamba) para cierre automático de turnos */
export const BUSINESS_TIMEZONE = 'America/La_Paz'

/** Si no marcan salida antes de esta hora (24h), el sistema cierra el turno */
export const AUTO_CLOSE_HOUR = 22 // 10:00 PM

/** Entrada después de esta hora = atrasado */
export const LATE_CHECKIN_HOUR = 9
export const LATE_CHECKIN_MINUTE = 15

export type AsistenciaEstado = 'presente' | 'atrasado' | 'ausente' | 'finalizado'
