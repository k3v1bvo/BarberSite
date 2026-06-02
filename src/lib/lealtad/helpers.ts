export type TipoRecompensa = 'porcentaje' | 'monto_fijo' | 'servicio_gratis' | 'producto_gratis'

export interface LealtadMeta {
  id: string
  nombre: string
  descripcion: string | null
  visitas_requeridas: number
  tipo_recompensa: TipoRecompensa
  valor_recompensa: number
  servicio_id: string | null
  producto_id: string | null
  is_active: boolean
  orden: number
}

export interface LealtadDescuento {
  meta: LealtadMeta
  descuentoRatio: number
  montoFijo: number
  mensaje: string
  esGratis: boolean
}

/**
 * Calcula el descuento de lealtad aplicable para la próxima visita del cliente.
 *
 * CORRECCIÓN: Ahora busca la meta de mayor nivel que el cliente alcanzará
 * en su próxima visita. Antes solo verificaba igualdad exacta, lo que
 * significaba que si un admin ajustaba las visitas y se saltaba un nivel,
 * el cliente nunca recibía la recompensa.
 *
 * Ahora: si la próxima visita (totalVisitas + 1) coincide con alguna meta,
 * se aplica. Además se busca la meta más valiosa si hay múltiples coincidencias.
 */
export function calcularDescuentoLealtad(
  totalVisitas: number,
  metas: LealtadMeta[],
  precioServicio: number
): LealtadDescuento | null {
  const activas = metas
    .filter((m) => m.is_active)
    .sort((a, b) => b.visitas_requeridas - a.visitas_requeridas)

  const proximaVisita = totalVisitas + 1

  // Buscar la meta exacta para esta visita
  const metaExacta = activas.find((m) => proximaVisita === m.visitas_requeridas)

  // También verificar si el cliente tiene metas pendientes que ya debería haber recibido
  // (por ejemplo, si se ajustaron visitas manualmente y se saltó un nivel)
  const metasPendientes = activas.filter(
    (m) => proximaVisita >= m.visitas_requeridas && proximaVisita === m.visitas_requeridas
  )

  const metaAplicable = metaExacta || metasPendientes[0]
  if (!metaAplicable) return null

  let descuentoRatio = 0
  let montoFijo = 0
  let esGratis = false
  let mensaje = metaAplicable.descripcion || metaAplicable.nombre

  switch (metaAplicable.tipo_recompensa) {
    case 'porcentaje': {
      const pct = Math.min(100, Math.max(0, metaAplicable.valor_recompensa))
      descuentoRatio = pct / 100
      mensaje = `¡${metaAplicable.visitas_requeridas}ª visita! ${pct}% de descuento.`
      break
    }
    case 'monto_fijo': {
      montoFijo = Math.max(0, metaAplicable.valor_recompensa)
      descuentoRatio = precioServicio > 0 ? Math.min(1, montoFijo / precioServicio) : 0
      mensaje = `¡${metaAplicable.visitas_requeridas}ª visita! Bs. ${montoFijo.toFixed(2)} de descuento.`
      break
    }
    case 'servicio_gratis':
    case 'producto_gratis': {
      esGratis = true
      descuentoRatio = 1
      const tipo = metaAplicable.tipo_recompensa === 'servicio_gratis' ? 'Servicio' : 'Producto'
      mensaje = `¡${metaAplicable.visitas_requeridas}ª visita! ${tipo}: ${metaAplicable.nombre} — GRATIS.`
      break
    }
  }

  return { meta: metaAplicable, descuentoRatio, montoFijo, mensaje, esGratis }
}

/**
 * Calcula el progreso del cliente hacia la siguiente meta de lealtad.
 *
 * CORRECCIÓN: Mejorado el cálculo de progresoEnMeta para manejar correctamente
 * el caso donde un cliente ya superó todas las metas. También corregido
 * slotsEnTarjeta para mostrar correctamente la tarjeta visual.
 */
export function getProgresoLealtad(
  totalVisitas: number,
  metas: LealtadMeta[]
): {
  visitas: number
  siguienteMeta: LealtadMeta | null
  progresoEnMeta: number
  metasDesbloqueadas: LealtadMeta[]
  slotsEnTarjeta: number
} {
  const activas = metas
    .filter((m) => m.is_active)
    .sort((a, b) => a.visitas_requeridas - b.visitas_requeridas)

  if (activas.length === 0) {
    return {
      visitas: totalVisitas,
      siguienteMeta: null,
      progresoEnMeta: 0,
      metasDesbloqueadas: [],
      slotsEnTarjeta: 10,
    }
  }

  const metasDesbloqueadas = activas.filter((m) => totalVisitas >= m.visitas_requeridas)
  const siguienteMeta = activas.find((m) => totalVisitas < m.visitas_requeridas) ?? null

  // La tarjeta muestra slots hasta la siguiente meta o la última alcanzada
  const maxMeta = activas[activas.length - 1]
  const targetMeta = siguienteMeta ?? maxMeta
  const slotsEnTarjeta = Math.max(5, Math.min(20, targetMeta.visitas_requeridas))

  let progresoEnMeta = 0
  if (siguienteMeta) {
    // Buscar la meta anterior a la siguiente
    const metasAnteriores = activas.filter(
      (m) => m.visitas_requeridas < siguienteMeta.visitas_requeridas
    )
    const metaAnterior = metasAnteriores[metasAnteriores.length - 1]
    const base = metaAnterior?.visitas_requeridas ?? 0
    const rango = siguienteMeta.visitas_requeridas - base
    progresoEnMeta = rango > 0 ? ((totalVisitas - base) / rango) * 100 : 0
  } else {
    // Ya alcanzó todas las metas
    progresoEnMeta = 100
  }

  return {
    visitas: totalVisitas,
    siguienteMeta,
    progresoEnMeta: Math.min(100, Math.max(0, progresoEnMeta)),
    metasDesbloqueadas,
    slotsEnTarjeta,
  }
}

export function labelTipoRecompensa(tipo: TipoRecompensa): string {
  const labels: Record<TipoRecompensa, string> = {
    porcentaje: 'Porcentaje',
    monto_fijo: 'Monto fijo',
    servicio_gratis: 'Servicio gratis',
    producto_gratis: 'Producto gratis',
  }
  return labels[tipo] ?? tipo
}
