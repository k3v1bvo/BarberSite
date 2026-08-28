/**
 * Utilidades para el cálculo inteligente de horarios de reserva continuos y flexibles.
 */

export interface OcupadoSlot {
  hora: string // Formato "HH:MM"
  duracion: number // Duración en minutos
}

export interface SmartSlot {
  hora: string
  disponible: boolean
  motivo?: string
  esContinuo?: boolean // Indica si es el inicio inmediato tras terminar otra cita
}

/**
 * Convierte una cadena "HH:MM" a minutos desde medianoche (0 a 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m || 0)
}

/**
 * Convierte minutos desde medianoche a formato "HH:MM".
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)))
  const h = Math.floor(normalized / 60).toString().padStart(2, '0')
  const m = (normalized % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Convierte "HH:MM" (formato 24h) a "h:mm AM/PM" (ej. "08:00" -> "8:00 AM", "14:30" -> "2:30 PM").
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ? mStr.padStart(2, '0') : '00'
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

/**
 * Valida si un horario específico está disponible para un servicio de cierta duración.
 */
export function isTimeSlotAvailable(
  hora: string,
  duracionServicio: number,
  ocupados: OcupadoSlot[],
  rangoInicio: string = '09:00',
  rangoFin: string = '20:00',
  fecha?: string,
  tiempoMinimoReserva: number = 0
): { disponible: boolean; motivo?: string } {
  const slotInicio = timeStringToMinutes(hora)
  const slotFin = slotInicio + Math.max(5, duracionServicio || 30)

  const jornadaInicio = timeStringToMinutes(rangoInicio)
  const jornadaFin = timeStringToMinutes(rangoFin)

  // 1. Validar que esté dentro del horario de atención
  if (slotInicio < jornadaInicio) {
    return { disponible: false, motivo: `Antes del horario de apertura (${rangoInicio})` }
  }
  if (slotFin > jornadaFin) {
    return { disponible: false, motivo: `El servicio finaliza después del cierre (${rangoFin})` }
  }

  // 2. Validar tiempo mínimo de anticipación (en hora de Bolivia)
  if (fecha && tiempoMinimoReserva > 0) {
    try {
      const nowBolivia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
      const [y, m, d] = fecha.split('-').map(Number)
      const [h, min] = hora.split(':').map(Number)
      const appointmentDate = new Date(y, m - 1, d, h, min, 0)

      const diffMs = appointmentDate.getTime() - nowBolivia.getTime()
      const diffMinutos = Math.floor(diffMs / 60000)

      if (diffMinutos < tiempoMinimoReserva) {
        const anticipacionTexto = tiempoMinimoReserva >= 1440 
          ? `${Math.round(tiempoMinimoReserva / 1440)} día` 
          : `${Math.round(tiempoMinimoReserva / 60)} hr(s)`
        return { 
          disponible: false, 
          motivo: `Requiere al menos ${anticipacionTexto} de anticipación` 
        }
      }
    } catch (_) {}
  }

  // 3. Validar colisión con citas o bloqueos existentes
  for (const oc of ocupados) {
    const ocInicio = timeStringToMinutes(oc.hora)
    const ocFin = ocInicio + Math.max(5, oc.duracion || 30)

    // Hay colisión si los rangos se solapan
    if (slotInicio < ocFin && ocInicio < slotFin) {
      return { 
        disponible: false, 
        motivo: `Horario ocupado (${oc.hora} a ${minutesToTimeString(ocFin)})` 
      }
    }
  }

  return { disponible: true }
}

/**
 * Genera todos los slots inteligentes disponibles:
 * 1. Horarios base cada `pasoMinutos` (por defecto 15 min).
 * 2. Horarios continuos exactos inmediatamente después de terminar citas previas (ej. 10:35, 11:20).
 * 3. Deduplicados y ordenados cronológicamente.
 */
export function generateSmartSlots(options: {
  rangoInicio?: string
  rangoFin?: string
  ocupados: OcupadoSlot[]
  duracionServicio: number
  pasoMinutos?: number
  fecha?: string
  tiempoMinimoReserva?: number
}): SmartSlot[] {
  const {
    rangoInicio = '09:00',
    rangoFin = '20:00',
    ocupados = [],
    duracionServicio = 30,
    pasoMinutos = 15, // Paso estándar de 15 minutos en lugar de 30
    fecha,
    tiempoMinimoReserva = 0
  } = options

  const startMin = timeStringToMinutes(rangoInicio)
  const endMin = timeStringToMinutes(rangoFin)
  const candidateMinutes = new Set<number>()
  const continuousMinutes = new Set<number>()

  // 1. Agregar intervalos regulares
  for (let m = startMin; m < endMin; m += pasoMinutos) {
    candidateMinutes.add(m)
  }

  // 2. Agregar puntos de inicio continuo tras cada cita/bloqueo previo
  for (const oc of ocupados) {
    const ocEnd = timeStringToMinutes(oc.hora) + Math.max(5, oc.duracion || 30)
    if (ocEnd >= startMin && ocEnd < endMin) {
      candidateMinutes.add(ocEnd)
      continuousMinutes.add(ocEnd)
    }
  }

  // 3. Convertir a array ordenado
  const sortedTimes = Array.from(candidateMinutes).sort((a, b) => a - b)

  // 4. Validar disponibilidad de cada candidato
  const result: SmartSlot[] = []
  for (const time of sortedTimes) {
    const horaStr = minutesToTimeString(time)
    const check = isTimeSlotAvailable(
      horaStr,
      duracionServicio,
      ocupados,
      rangoInicio,
      rangoFin,
      fecha,
      tiempoMinimoReserva
    )

    result.push({
      hora: horaStr,
      disponible: check.disponible,
      motivo: check.motivo,
      esContinuo: continuousMinutes.has(time)
    })
  }

  return result
}
