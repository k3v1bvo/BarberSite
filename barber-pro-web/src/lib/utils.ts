import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)}`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Convierte cualquier texto a formato Título / Mayúscula en cada palabra.
 * Ej: "corte de cabello clasico" -> "Corte De Cabello Clasico"
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Convierte cualquier texto a formato Oración (Solo la primera letra en mayúscula y el resto en minúsculas).
 * Ej: "COMBO CORTE DE CABELLO + MASCARILLA NEGRA" -> "Combo corte de cabello + mascarilla negra"
 */
export function toSentenceCase(str: string | null | undefined): string {
  if (!str) return ''
  const trimmed = str.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export function getTodayBolivia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/**
 * Convierte un arreglo de objetos a CSV y lo descarga en el navegador.
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return

  // Obtener encabezados
  const headers = Object.keys(data[0])
  
  // Construir filas
  const csvRows = []
  
  // Agregar encabezados
  csvRows.push(headers.join(','))
  
  // Agregar valores
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }
  
  const csvString = csvRows.join('\n')
  
  // Descargar usando Blob
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}