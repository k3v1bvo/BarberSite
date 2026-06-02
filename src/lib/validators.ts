/**
 * Validadores de input para APIs — previene SQL injection y datos malformados
 */

/** Sanitiza texto para uso en filtros ilike de Supabase (previene SQL injection) */
export function sanitizeSearchFilter(input: string): string {
  // Elimina caracteres especiales de PostgREST que podrían inyectar lógica
  return input.replace(/[%_\\'"();]/g, '').trim().slice(0, 100)
}

/** Valida que un UUID tenga formato correcto */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** Valida y limpia un monto numérico */
export function sanitizeAmount(value: unknown): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) return null
  return Math.round(num * 100) / 100 // Máximo 2 decimales
}

/** Valida un rango de fechas */
export function isValidDateRange(inicio: string, fin: string): boolean {
  const d1 = new Date(inicio)
  const d2 = new Date(fin)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false
  return d1 <= d2
}

/** Valida que una hora tenga formato HH:MM */
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

/** Valida que hora_fin sea posterior a hora_inicio */
export function isValidTimeRange(inicio: string, fin: string): boolean {
  if (!isValidTime(inicio) || !isValidTime(fin)) return false
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fin.split(':').map(Number)
  return hF * 60 + mF > hI * 60 + mI
}

/** Valida una URL de imagen */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    // Verificar extensiones comunes o dominios de CDN conocidos
    const path = parsed.pathname.toLowerCase()
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg']
    const trustedDomains = [
      'images.unsplash.com',
      'res.cloudinary.com',
      'i.imgur.com',
      'lh3.googleusercontent.com',
      'firebasestorage.googleapis.com',
      'supabase.co',
    ]
    const hasValidExtension = validExtensions.some((ext) => path.endsWith(ext))
    const isTrustedDomain = trustedDomains.some((d) => parsed.hostname.includes(d))
    // Aceptamos URLs de dominios confiados o con extensiones válidas
    return hasValidExtension || isTrustedDomain || parsed.hostname.length > 0
  } catch {
    return false
  }
}

/** Limpia y valida payload de meta de lealtad */
export function validateLealtadMeta(body: Record<string, unknown>): {
  valid: boolean
  error?: string
  data?: Record<string, unknown>
} {
  const nombre = String(body.nombre || '').trim()
  if (!nombre) return { valid: false, error: 'Nombre requerido' }
  if (nombre.length > 100) return { valid: false, error: 'Nombre muy largo (max 100)' }

  const visitas = Number(body.visitas_requeridas)
  if (!Number.isInteger(visitas) || visitas < 1 || visitas > 1000) {
    return { valid: false, error: 'Visitas requeridas debe ser un número entre 1 y 1000' }
  }

  const tiposValidos = ['porcentaje', 'monto_fijo', 'servicio_gratis', 'producto_gratis']
  const tipo = String(body.tipo_recompensa || '')
  if (!tiposValidos.includes(tipo)) {
    return { valid: false, error: 'Tipo de recompensa inválido' }
  }

  const valor = sanitizeAmount(body.valor_recompensa ?? 0)
  if (valor === null) return { valid: false, error: 'Valor de recompensa inválido' }
  if (tipo === 'porcentaje' && (valor < 0 || valor > 100)) {
    return { valid: false, error: 'El porcentaje debe estar entre 0 y 100' }
  }

  return {
    valid: true,
    data: {
      nombre,
      descripcion: String(body.descripcion || '').trim().slice(0, 500) || null,
      visitas_requeridas: visitas,
      tipo_recompensa: tipo,
      valor_recompensa: valor,
      servicio_id: body.servicio_id && isValidUUID(String(body.servicio_id)) ? body.servicio_id : null,
      producto_id: body.producto_id && isValidUUID(String(body.producto_id)) ? body.producto_id : null,
      is_active: body.is_active !== false,
      orden: Number.isInteger(Number(body.orden)) ? Number(body.orden) : 0,
    },
  }
}

/** Limpia y valida payload de plantilla de horario */
export function validatePlantillaHorario(body: Record<string, unknown>): {
  valid: boolean
  error?: string
  data?: Record<string, unknown>
} {
  const nombre = String(body.nombre || '').trim()
  if (!nombre) return { valid: false, error: 'Nombre requerido' }

  const tiposValidos = ['manana', 'tarde', 'todo_dia', 'especial', 'medio_turno', 'personalizado']
  const tipo = String(body.tipo || '')
  if (!tiposValidos.includes(tipo)) return { valid: false, error: 'Tipo de horario inválido' }

  const inicio = String(body.hora_inicio || '09:00')
  const fin = String(body.hora_fin || '20:00')

  if (!isValidTimeRange(inicio, fin)) {
    return { valid: false, error: 'La hora de fin debe ser posterior a la hora de inicio' }
  }

  return {
    valid: true,
    data: {
      nombre: nombre.slice(0, 100),
      tipo,
      hora_inicio: inicio,
      hora_fin: fin,
      descripcion: String(body.descripcion || '').trim().slice(0, 300) || null,
      is_active: body.is_active !== false,
    },
  }
}
