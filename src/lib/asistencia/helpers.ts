import {
  AUTO_CLOSE_HOUR,
  BUSINESS_TIMEZONE,
  LATE_CHECKIN_HOUR,
  LATE_CHECKIN_MINUTE,
  type AsistenciaEstado,
} from './constants'
import { getHorarioBarberoDia } from '@/lib/horarios/helpers'

export type { AsistenciaEstado }

export function getBusinessNow(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: BUSINESS_TIMEZONE })
  )
}

export function getBusinessDateString(d = getBusinessNow()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isAfterAutoCloseHour(d = getBusinessNow()): boolean {
  return d.getHours() >= AUTO_CLOSE_HOUR
}

export function getAutoCloseTimestamp(fecha: string): string {
  return `${fecha}T${String(AUTO_CLOSE_HOUR).padStart(2, '0')}:00:00-04:00`
}

export function computeEstadoFromRecord(
  record: {
    hora_entrada: string
    hora_salida: string | null
    estado?: string | null
    cierre_automatico?: boolean | null
  },
  horaInicioProgramada?: string | null
): AsistenciaEstado {
  if (record.estado === 'finalizado' || record.hora_salida) {
    return 'finalizado'
  }
  if (!record.hora_entrada) {
    return 'ausente'
  }

  const entrada = new Date(record.hora_entrada)
  const entradaLocal = new Date(
    entrada.toLocaleString('en-US', { timeZone: BUSINESS_TIMEZONE })
  )

  let lateThreshold = new Date(entradaLocal)
  lateThreshold.setHours(LATE_CHECKIN_HOUR, LATE_CHECKIN_MINUTE, 0, 0)

  if (horaInicioProgramada) {
    const [h, m] = horaInicioProgramada.split(':').map(Number)
    if (!Number.isNaN(h)) {
      lateThreshold = new Date(entradaLocal)
      lateThreshold.setHours(h, m ?? 0, 0, 0)
      lateThreshold.setMinutes(lateThreshold.getMinutes() + 10)
    }
  }

  if (entradaLocal > lateThreshold) {
    return 'atrasado'
  }

  return 'presente'
}

export async function getHorarioEsperadoEntrada(
  supabase: { from: (table: string) => unknown },
  profileId: string,
  fecha: string
): Promise<string | null> {
  const horario = await getHorarioBarberoDia(supabase as Parameters<typeof getHorarioBarberoDia>[0], profileId, fecha)
  return horario.activo ? horario.hora_inicio : null
}

export async function getHorarioEsperadoSalida(
  supabase: { from: (table: string) => unknown },
  profileId: string,
  fecha: string
): Promise<string | null> {
  const horario = await getHorarioBarberoDia(supabase as Parameters<typeof getHorarioBarberoDia>[0], profileId, fecha)
  return horario.activo ? horario.hora_fin : null
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
