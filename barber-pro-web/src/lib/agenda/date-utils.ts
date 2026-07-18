export const BOLIVIA_TZ = 'America/La_Paz'

/**
 * Asegura que el string ISO se analice correctamente en la zona horaria de Bolivia,
 * incluso si no tiene información de zona horaria.
 */
export function parseBoliviaDate(isoString: string): Date {
  if (!isoString) return new Date()
  
  // Si ya tiene un offset (Z o +-HH:mm), el Date nativo lo parsea bien en UTC absolutos.
  if (isoString.includes('Z') || isoString.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(isoString)
  }
  
  // Si no tiene zona horaria (ej: de un timestamp without time zone de Supabase)
  // le añadimos el offset de Bolivia (-04:00) para forzar que sea UTC-4, evitando el mismatch de SSR.
  return new Date(`${isoString}-04:00`)
}

export function getBoliviaDateKey(isoString: string): string {
  if (!isoString) return ''
  const d = parseBoliviaDate(isoString)
  if (isNaN(d.getTime())) return isoString.split('T')[0] || ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOLIVIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function getBoliviaTimeStr(isoString: string): string {
  if (!isoString) return ''
  const d = parseBoliviaDate(isoString)
  if (isNaN(d.getTime())) return isoString.split('T')[1]?.slice(0, 5) || ''
  return d.toLocaleTimeString('es-BO', { timeZone: BOLIVIA_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
}

export function getBoliviaDateTimeStr(isoString: string): string {
  if (!isoString) return ''
  const d = parseBoliviaDate(isoString)
  if (isNaN(d.getTime())) return isoString
  const datePart = new Intl.DateTimeFormat('es-BO', { timeZone: BOLIVIA_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const timePart = d.toLocaleTimeString('es-BO', { timeZone: BOLIVIA_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  const capitalizedDate = datePart.charAt(0).toUpperCase() + datePart.slice(1)
  return `${capitalizedDate}, ${timePart}`
}

export function getBoliviaHour(isoString: string): number {
  if (!isoString) return 0
  const d = parseBoliviaDate(isoString)
  if (isNaN(d.getTime())) return parseInt(isoString.split('T')[1]?.slice(0, 2) || '0', 10)
  const hourStr = d.toLocaleTimeString('es-BO', { timeZone: BOLIVIA_TZ, hour: '2-digit', hour12: false })
  return parseInt(hourStr, 10)
}
