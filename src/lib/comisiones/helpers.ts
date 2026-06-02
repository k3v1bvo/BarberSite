export type ComisionTipo = 'ninguna' | 'porcentaje' | 'fija'

export interface ServicioComision {
  precio: number
  comision_activa?: boolean | null
  comision_tipo?: ComisionTipo | null
  comision_valor?: number | null
  comision_acumulable?: boolean | null
}

export interface BarberoComisionFallback {
  comision_porcentaje?: number | null
}

export function calcularComisionServicio(
  servicio: ServicioComision,
  barbero?: BarberoComisionFallback,
  propinas = 0
): number {
  const precio = servicio.precio || 0
  let comision = 0

  if (servicio.comision_activa === false || servicio.comision_tipo === 'ninguna') {
    comision = 0
  } else if (servicio.comision_tipo === 'fija' && servicio.comision_valor != null) {
    comision = Number(servicio.comision_valor)
  } else if (servicio.comision_tipo === 'porcentaje' && servicio.comision_valor != null) {
    comision = (precio * Number(servicio.comision_valor)) / 100
  } else {
    const pct = barbero?.comision_porcentaje ?? 30
    comision = (precio * pct) / 100
  }

  const propinaBarbero = servicio.comision_acumulable ? propinas * 0.5 : 0
  return comision + propinaBarbero
}

export function agregarPropinaComision(
  comisionActual: number,
  propinas: number,
  acumulable?: boolean
): number {
  if (!acumulable) return comisionActual
  return comisionActual + propinas * 0.5
}
