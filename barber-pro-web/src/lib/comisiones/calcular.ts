import { SupabaseClient } from '@supabase/supabase-js'

interface ComisionResult {
  monto: number
  categoria_nombre: string | null
  tiene_herramientas: boolean | null
  tipo_usado: string    // 'personalizada' | 'global' | 'ninguna'
  comision_tipo: string // 'porcentaje' | 'fija' | 'ninguna'
  comision_valor: number
}

/**
 * Calcula la comisión de un barbero para un servicio determinado.
 *
 * Flujo:
 * 1. Buscar si el barbero tiene comision_barbero_horario para el día de la semana
 * 2. Si tiene → obtener categoría + herramientas del día
 * 3. Buscar comision_barbero_servicios para barbero + servicio + categoría
 * 4. Elegir comisión con/sin herramientas según configuración del día
 * 5. Si NO tiene config personalizada → usar comisión global del servicio como fallback
 *
 * @param supabase - Cliente Supabase autenticado
 * @param barbero_id - ID del barbero
 * @param servicio_id - ID del servicio
 * @param precio_servicio - Precio base del servicio
 * @param fecha - Fecha de la cita (para determinar día de la semana). Si no se pasa, usa hoy.
 * @param servicio_global - Datos de comisión global del servicio (fallback)
 */
export async function calcularComisionBarbero(
  supabase: SupabaseClient,
  barbero_id: string,
  servicio_id: string,
  precio_servicio: number,
  fecha?: Date | string,
  servicio_global?: {
    comision_activa?: boolean
    comision_tipo?: string
    comision_valor?: number
    comision_acumulable?: boolean
  }
): Promise<ComisionResult> {
  const resultado: ComisionResult = {
    monto: 0,
    categoria_nombre: null,
    tiene_herramientas: null,
    tipo_usado: 'ninguna',
    comision_tipo: 'ninguna',
    comision_valor: 0,
  }

  try {
    // Determinar día de la semana (0=Domingo, 6=Sábado)
    const d = fecha ? new Date(fecha) : new Date()
    const diaSemana = d.getDay() // 0=Sunday, 1=Monday, ... 6=Saturday

    // 1. Buscar horario del barbero para este día
    const { data: horarioDia } = await supabase
      .from('comision_barbero_horario')
      .select('categoria_id, tiene_herramientas, categoria:comision_categorias(id, nombre, requiere_herramientas)')
      .eq('barbero_id', barbero_id)
      .eq('dia_semana', diaSemana)
      .single()

    if (horarioDia && horarioDia.categoria_id) {
      const cat = horarioDia.categoria as any
      resultado.categoria_nombre = cat?.nombre || null
      resultado.tiene_herramientas = cat?.requiere_herramientas
        ? true // Si la categoría requiere herramientas, siempre es true
        : horarioDia.tiene_herramientas

      // 2. Buscar comisión personalizada para este servicio + categoría
      const { data: comisionPersonal } = await supabase
        .from('comision_barbero_servicios')
        .select('*')
        .eq('barbero_id', barbero_id)
        .eq('servicio_id', servicio_id)
        .eq('categoria_id', horarioDia.categoria_id)
        .single()

      if (comisionPersonal) {
        // Usar la comisión con/sin herramientas según el día
        const conH = resultado.tiene_herramientas
        const tipo = conH ? comisionPersonal.comision_tipo_con : comisionPersonal.comision_tipo_sin
        const valor = conH ? comisionPersonal.comision_valor_con : comisionPersonal.comision_valor_sin

        resultado.comision_tipo = tipo || 'ninguna'
        resultado.comision_valor = valor || 0
        resultado.tipo_usado = 'personalizada'

        if (tipo === 'fija') {
          resultado.monto = valor || 0
        } else if (tipo === 'porcentaje') {
          resultado.monto = (precio_servicio * (valor || 0)) / 100
        }
        // 'ninguna' → monto = 0

        return resultado
      }
    }

    // 3. Fallback: usar comisión global del servicio
    if (servicio_global && servicio_global.comision_activa !== false && servicio_global.comision_tipo !== 'ninguna') {
      resultado.tipo_usado = 'global'
      resultado.comision_tipo = servicio_global.comision_tipo || 'ninguna'
      resultado.comision_valor = servicio_global.comision_valor || 0

      if (servicio_global.comision_tipo === 'fija') {
        resultado.monto = servicio_global.comision_valor || 0
      } else if (servicio_global.comision_tipo === 'porcentaje') {
        resultado.monto = (precio_servicio * (servicio_global.comision_valor || 0)) / 100
      }
    }

    return resultado
  } catch (err) {
    console.error('[calcularComisionBarbero] Error:', err)
    return resultado
  }
}
