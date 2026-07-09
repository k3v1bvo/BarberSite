export interface AgendaCita {
  id: string
  fecha_hora: string
  duracion_minutos: number
  estado: 'pendiente' | 'pendiente_pago' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_presento'
  reprogramacion_estado?: string
  fecha_hora_solicitada?: string
  anticipo_monto?: number
  cliente_nombre: string
  servicio_nombre: string
  precio: number
  barbero_id: string
  barbero_nombre: string
  comprobante_url?: string
}

export interface AgendaResponse {
  citas: AgendaCita[]
  periodo: { inicio: string; fin: string }
}
