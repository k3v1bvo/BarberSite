import {
  AUTO_CLOSE_HOUR,
  BUSINESS_TIMEZONE,
  LATE_CHECKIN_HOUR,
  LATE_CHECKIN_MINUTE,
  type AsistenciaEstado,
} from './constants'

export type { AsistenciaEstado }

export function getBusinessNow(): Date {
  // Safe way to get a Date object that reflects the local time in Bolivia (UTC-4).
  // This creates a Date object where getHours(), getMinutes(), etc. match La Paz time,
  // assuming the server is running in UTC (which Vercel Edge/Node does).
  const utcNow = new Date()
  return new Date(utcNow.getTime() - 4 * 60 * 60 * 1000)
}

export function getBusinessDateString(d = new Date()): string {
  // Bolivia is always UTC-4 (no DST).
  // We subtract 4 hours from the UTC time to get the local time in La Paz.
  const localTime = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMondayOfWeek(d = new Date()): Date {
  const localTime = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  const day = localTime.getUTCDay()
  const diff = localTime.getUTCDate() - day + (day === 0 ? -6 : 1)
  const year = localTime.getUTCFullYear()
  const month = localTime.getUTCMonth()
  return new Date(Date.UTC(year, month, diff, 12, 0, 0))
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

export function isAfterAutoCloseHour(d = getBusinessNow()): boolean {
  // getBusinessNow() already shifted the UTC time by -4 hours.
  // So we MUST use getUTCHours() to get the La Paz hour reliably, regardless of the server's OS timezone.
  return d.getUTCHours() >= AUTO_CLOSE_HOUR
}

export function getAutoCloseTimestamp(fecha: string): string {
  return `${fecha}T${String(AUTO_CLOSE_HOUR).padStart(2, '0')}:00:00-04:00`
}

export function computeEstadoFromRecord(record: {
  hora_entrada: string
  hora_salida: string | null
  estado?: string | null
  cierre_automatico?: boolean | null
}): AsistenciaEstado {
  if (record.estado === 'finalizado' || record.hora_salida) {
    return 'finalizado'
  }
  if (!record.hora_entrada) {
    return 'ausente'
  }

  const entrada = new Date(record.hora_entrada)
  // Shift to UTC-4 (La Paz)
  const entradaLocal = new Date(entrada.getTime() - 4 * 60 * 60 * 1000)

  const lateThreshold = new Date(entradaLocal.getTime())
  lateThreshold.setUTCHours(LATE_CHECKIN_HOUR, LATE_CHECKIN_MINUTE, 0, 0)

  if (entradaLocal.getTime() > lateThreshold.getTime()) {
    return 'atrasado'
  }

  return 'presente'
}

export function estadoLabel(estado: AsistenciaEstado): string {
  const labels: Record<AsistenciaEstado, string> = {
    presente: 'Presente',
    atrasado: 'Atrasado',
    ausente: 'Ausente',
    finalizado: 'Turno finalizado',
  }
  return labels[estado]
}

export function estadoBadgeVariant(
  estado: AsistenciaEstado
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (estado) {
    case 'presente':
      return 'success'
    case 'atrasado':
      return 'warning'
    case 'ausente':
      return 'danger'
    case 'finalizado':
      return 'default'
    default:
      return 'info'
  }
}

// ─── Utilidades centralizadas de fecha/hora Bolivia (UTC-4) ───────────────
// Usar estas funciones en TODO el backend para evitar bugs de zona horaria.
// NUNCA usar new Date().getHours(), .getDay(), .getMonth(), etc. directamente.

/** Alias corto de getBusinessDateString — fecha Bolivia como YYYY-MM-DD */
export const getBoliviaDateString = getBusinessDateString

/** Día de semana en Bolivia (0=Dom...6=Sáb) */
export function getBoliviaDayOfWeek(d = new Date()): number {
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  return local.getUTCDay()
}

/** Mes actual en Bolivia (1-12) */
export function getBoliviaMonth(d = new Date()): number {
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  return local.getUTCMonth() + 1
}

/** Año actual en Bolivia */
export function getBoliviaYear(d = new Date()): number {
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  return local.getUTCFullYear()
}

/** Hora y minuto actuales en Bolivia */
export function getBoliviaTime(d = new Date()): { hour: number; minute: number } {
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  return { hour: local.getUTCHours(), minute: local.getUTCMinutes() }
}

/** Día del mes en Bolivia (1-31) */
export function getBoliviaDay(d = new Date()): number {
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  return local.getUTCDate()
}

