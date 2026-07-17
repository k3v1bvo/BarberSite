// Tipos principales para Barber Pro Web

export type Role = 'admin' | 'coordinador' | 'barbero' | 'cliente'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  ci: string | null
  role: Role
  is_active: boolean
  comision_porcentaje: number
  created_at: string
}

export type ComisionTipo = 'porcentaje' | 'fija' | 'ninguna'

export type CategoriaServicio = 'Cortes' | 'Combos' | 'Cuidado Facial' | 'Permanentes' | 'Otros'

export const CATEGORIAS_SERVICIOS: { id: CategoriaServicio; label: string; descripcion: string }[] = [
  { id: 'Cortes', label: 'Servicio Cortes', descripcion: 'Cortes de cabello, barba, perfilados y diseños.' },
  { id: 'Combos', label: 'Servicios en Combo', descripcion: 'Paquetes completos que combinan corte, barba, cejas o cuidado facial.' },
  { id: 'Cuidado Facial', label: 'Servicio Cuidado Facial', descripcion: 'Limpiezas profundas, exfoliaciones, mascarillas y tratamientos faciales.' },
  { id: 'Permanentes', label: 'Servicios Permanentes', descripcion: 'Permanentes, ondulados y tratamientos capilares.' },
  { id: 'Otros', label: 'Otros Servicios', descripcion: 'Servicios generales o complementarios.' },
]

export interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  duracion_minutos: number
  color: string
  is_active: boolean
  imagen_url?: string | null
  imagenes?: string[] | null
  categoria?: string
  comision_activa?: boolean
  comision_tipo?: ComisionTipo
  comision_valor?: number
  comision_acumulable?: boolean
  barberos_excluidos?: string[]
}

export interface Cliente {
  id: string
  nombre: string
  ci: string | null
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  notas: string | null
  nivel_fidelidad: 'BRONCE' | 'PLATA' | 'ORO'
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
  metodo_pago: string | null
  propinas: number
  productos_adicionales: any
  notas: string | null
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
  notas: string | null
  created_at: string
  profile?: Profile
}

// =============================================
// Horarios
// =============================================

export type TipoHorario = 'manana' | 'tarde' | 'todo_dia' | 'medio_turno' | 'especial' | 'personalizado'

export interface PlantillaHorario {
  id: string
  nombre: string
  tipo: TipoHorario
  hora_inicio: string
  hora_fin: string
  descripcion?: string
  is_active: boolean
}

// =============================================
// Lealtad
// =============================================

export type TipoRecompensa = 'porcentaje' | 'monto_fijo' | 'servicio_gratis' | 'producto_gratis'

export interface LealtadMeta {
  id: string
  nombre: string
  descripcion: string
  visitas_requeridas: number
  tipo_recompensa: TipoRecompensa
  valor_recompensa: number
  servicio_id: string | null
  producto_id: string | null
  is_active: boolean
  orden: number
}

// =============================================
// Tipos del ERP Contable
// =============================================

export type Libro = 'CAJA_CHICA' | 'VENTAS' | 'SERVICIOS' | 'BANCO'

export type TipoMovimiento =
  | 'PAGO_CLIENTE'
  | 'SANCCION'
  | 'ADELANTO'
  | 'DEPOSITO'
  | 'VENTA_PRODUCTO'
  | 'APORTE_CAPITAL'
  | 'RETIRO'
  | 'AJUSTE'
  | 'EGRESO'

export interface PlanCuenta {
  id: string
  codigo: string
  detalle: string
  tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'EGRESO'
  nivel: number
  es_sancion: boolean
}

export interface Transaction {
  id: string
  libro: Libro
  fecha: string
  ci: string
  nombre: string
  cuenta_codigo: string
  cuenta_detalle: string
  glosa: string
  costo: number
  tipo_movimiento: TipoMovimiento
  es_sancion: boolean
  empleado_id: string | null
  cliente_id: string | null
  usuario_registro: string
  notas: string | null
  creado_en: string
}

export interface DailyClosure {
  id: string
  fecha: string
  caja_chica: number
  ventas: number
  servicios: number
  banco: number
  total_registrado: number
  total_efectivo_fisico: number
  total_qr: number
  diferencia: number
  observaciones: string | null
  usuario_cierre: string
  cerrado: boolean
}

export interface Bono {
  id: string
  barbero_id: string
  tipo: 'puntualidad' | 'cantidad_servicios' | 'metas' | 'otro'
  descripcion: string | null
  monto: number
  mes: number
  anio: number
  pagado: boolean
  pagado_at?: string
  creado_en?: string
}

export interface CatalogoSancion {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  monto_sugerido: number
  is_active: boolean
  created_at: string
}

export interface CatalogoBono {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  monto_sugerido: number
  is_active: boolean
  created_at: string
}

export interface Egreso {
  id: string
  fecha: string
  concepto: string
  proveedor: string | null
  monto_bruto: number
  tiene_factura: boolean
  iva: number
  it: number
  monto_neto: number
  numero_factura: string | null
  cuenta_codigo: string | null
  usuario_registro: string
  notas: string | null
}