import {
  AUTO_CLOSE_HOUR,
  BUSINESS_TIMEZONE,
  LATE_CHECKIN_HOUR,
  LATE_CHECKIN_MINUTE,
  type AsistenciaEstado,
} from './constants'

export type { AsistenciaEstado }

export function getBusinessNow(): Date {
  const utcNow = new Date()
  return new Date(utcNow.getTime() - 4 * 60 * 60 * 1000)
}

export function getBusinessDateString(d = new Date()): string {
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
  if (record.cierre_automatico) {
    return 'finalizado'
  }
  const entrada = new Date(record.hora_entrada)
  const localEntrada = new Date(entrada.getTime() - 4 * 60 * 60 * 1000)
  const h = localEntrada.getUTCHours()
  const m = localEntrada.getUTCMinutes()
  if (h > LATE_CHECKIN_HOUR || (h === LATE_CHECKIN_HOUR && m > LATE_CHECKIN_MINUTE)) {
    return 'atrasado'
  }
  return 'presente'
}

export function estadoLabel(estado: AsistenciaEstado): string {
  switch (estado) {
    case 'presente':
      return 'Presente'
    case 'atrasado':
      return 'Atrasado'
    case 'finalizado':
      return 'Finalizado'
    case 'ausente':
      return 'Ausente'
    default:
      return estado
  }
}

export function estadoBadgeVariant(estado: AsistenciaEstado): 'success' | 'warning' | 'danger' | 'info' {
  switch (estado) {
    case 'presente':
      return 'success'
    case 'atrasado':
      return 'danger'
    case 'finalizado':
      return 'info'
    case 'ausente':
      return 'danger'
    default:
      return 'info'
  }
}
