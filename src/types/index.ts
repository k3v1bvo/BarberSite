// Tipos principales para Barber Pro Web

export type Role = 'admin' | 'recepcionista' | 'barbero' | 'cliente'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: Role
  is_active: boolean
  comision_porcentaje: number
  created_at: string
}

export type ComisionTipo = 'ninguna' | 'porcentaje' | 'fija'
export type TipoRecompensa = 'porcentaje' | 'monto_fijo' | 'servicio_gratis' | 'producto_gratis'
export type TipoHorario = 'manana' | 'tarde' | 'todo_dia' | 'especial' | 'medio_turno' | 'personalizado'
export type PeriodoComision = 'diario' | 'semanal' | 'personalizado'

export interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  duracion_minutos: number
  color: string
  is_active: boolean
  comision_activa?: boolean
  comision_tipo?: ComisionTipo
  comision_valor?: number
  comision_acumulable?: boolean
  comision_notas?: string | null
}

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

export interface LealtadCanje {
  id: string
  cliente_id: string
  meta_id: string | null
  cita_id: string | null
  descripcion: string
  notas: string | null
  canjeado_at: string
}

export interface ComisionPago {
  id: string
  barbero_id: string
  periodo_tipo: PeriodoComision
  fecha_inicio: string
  fecha_fin: string
  monto_total: number
  metodo_pago: string | null
  admin_id: string | null
  notas: string | null
  pagado_at: string
  barbero?: Profile
}

export interface PortafolioItem {
  id: string
  image_url: string
  categoria: string
  descripcion: string
  barbero_id: string
  is_active?: boolean
  sort_order?: number
  titulo?: string | null
  created_at?: string
}

export interface PlantillaHorario {
  id: string
  nombre: string
  tipo: TipoHorario
  hora_inicio: string
  hora_fin: string
  descripcion: string | null
  is_active: boolean
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  notas: string | null
  total_visitas: number
  total_gastado: number
  ultima_visita: string | null
}

export interface Cita {
  id: string
  cliente_id: string | null
  barbero_id: string | null
  servicio_id: string | null
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_presento'
  fecha_hora: string
  duracion_real_minutos: number | null
  precio: number
  comision_barbero: number | null
  comision_pagada?: boolean
  comision_pago_id?: string | null
  metodo_pago: string | null
  propinas: number
  productos_adicionales: any
  notas: string | null
  finished_at?: string | null
  // Joined data
  cliente?: Cliente
  barbero?: Profile
  servicio?: Servicio
}

export interface Producto {
  id: string
  nombre: string
  sku: string | null
  descripcion: string | null
  stock_actual: number
  stock_minimo: number
  precio_costo: number | null
  precio_venta: number
  categoria: string | null
  is_active: boolean
}

export interface Asistencia {
  id: string
  profile_id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  horas_trabajadas: number | null
  horas_extras?: number | null
  notas: string | null
  created_at: string
  profile?: Profile
}