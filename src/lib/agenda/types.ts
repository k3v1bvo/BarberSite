export interface AgendaCita {
  id: string
  fecha_hora: string
  duracion_minutos: number
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_presento'
  cliente_nombre: string
  servicio_nombre: string
  precio: number
  barbero_id: string
  barbero_nombre: string
}

export interface AgendaResponse {
  citas: AgendaCita[]
  periodo: { inicio: string; fin: string }
}
