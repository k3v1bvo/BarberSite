import { TipoRecompensa } from '@/types'

export function labelTipoRecompensa(tipo: TipoRecompensa): string {
  switch (tipo) {
    case 'porcentaje':
      return 'Descuento (%)'
    case 'monto_fijo':
      return 'Descuento (Fijo)'
    case 'servicio_gratis':
      return 'Servicio Gratis'
    case 'producto_gratis':
      return 'Producto Gratis'
    default:
      return tipo
  }
}
