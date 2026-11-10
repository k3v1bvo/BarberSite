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
 * Determina el porcentaje base por horas de turno del barbero según su horario semanal:
 * - >= 11 horas: 50%
 * - >= 10 horas: 45%
 * - >= 8 horas: 40%
 */
export async function obtenerPorcentajePorHoras(
  supabase: SupabaseClient,
  barbero_id: string,
  diaSemana: number
): Promise<number | null> {
  try {
    const { data: horario } = await supabase
      .from('barbero_horario_semanal')
      .select('hora_inicio, hora_fin, activo')
      .eq('barbero_id', barbero_id)
      .eq('dia_semana', diaSemana)
      .maybeSingle()

    if (horario && horario.activo && horario.hora_inicio && horario.hora_fin) {
      const [hIni, mIni = 0] = horario.hora_inicio.split(':').map(Number)
      const [hFin, mFin = 0] = horario.hora_fin.split(':').map(Number)
      const horas = (hFin + mFin / 60) - (hIni + mIni / 60)

      let p8 = 40, p10 = 45, p11 = 50
      try {
        const { data: configList } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .in('clave', ['comision_horas_8', 'comision_horas_10', 'comision_horas_11'])
        configList?.forEach(c => {
          if (c.clave === 'comision_horas_8' && Number(c.valor)) p8 = Number(c.valor)
          if (c.clave === 'comision_horas_10' && Number(c.valor)) p10 = Number(c.valor)
          if (c.clave === 'comision_horas_11' && Number(c.valor)) p11 = Number(c.valor)
        })
      } catch (_) {}

      if (horas >= 10.75) return p11
      if (horas >= 9.75) return p10
      if (horas >= 7.75) return p8
    }
  } catch (err) {
    console.error('[obtenerPorcentajePorHoras] Error:', err)
  }
  return null
}

/**
 * Calcula la comisión de un barbero para un servicio determinado.
 *
 * Flujo:
 * 1. Buscar si el barbero tiene comision_barbero_horario para el día de la semana
 * 2. Si tiene → obtener categoría + herramientas del día
 * 3. Buscar comision_barbero_servicios para barbero + servicio + categoría
 * 4. Elegir comisión con/sin herramientas según configuración del día
 * 5. Si NO tiene config personalizada:
 *    - Si el servicio es fijo (Corte de niño Bs 20, Baño de luna Bs 20, Combo Bs 32) → Paga monto fijo
 *    - Si es Tintes (35%) o Diseño (50%) → Paga porcentaje de servicio
 *    - Si es servicio general: calcula según horas de jornada del barbero (8h=40%, 10h=45%, 11h=50%)
 *    - Fallback: porcentaje base de perfil del barbero (profiles.comision_porcentaje)
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
    precio?: number
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
    // Determinar día de la semana (0=Domingo, 6=Sábado) de forma segura sin desface horario
    let diaSemana = new Date().getDay()
    if (fecha) {
      if (typeof fecha === 'string') {
        const cleanStr = fecha.trim()
        if (cleanStr.length === 10 && cleanStr.includes('-')) {
          const [year, month, day] = cleanStr.split('-').map(Number)
          diaSemana = new Date(year, month - 1, day, 12, 0, 0).getDay()
        } else {
          diaSemana = new Date(cleanStr).getDay()
        }
      } else if (fecha instanceof Date) {
        diaSemana = fecha.getDay()
      }
    }

    // 0. Obtener precio de catálogo y configuración oficial del servicio
    let servConfig = servicio_global
    let servNombre = ''
    let precioCatalogo = (servicio_global as any)?.precio ? Number((servicio_global as any).precio) : 0

    if (servicio_id) {
      const { data: servDb } = await supabase
        .from('servicios')
        .select('nombre, precio, comision_activa, comision_tipo, comision_valor')
        .eq('id', servicio_id)
        .maybeSingle()

      if (servDb) {
        servNombre = servDb.nombre || ''
        if (Number(servDb.precio) > 0) {
          precioCatalogo = Number(servDb.precio)
        }
        if (!servConfig) {
          servConfig = {
            precio: servDb.precio,
            comision_activa: servDb.comision_activa,
            comision_tipo: servDb.comision_tipo,
            comision_valor: servDb.comision_valor
          }
        }
      }
    }

    // REGLA CRÍTICA DE COMISIONES:
    // El monto del % se saca SIEMPRE del precio oficial del servicio (corte base / catálogo),
    // NUNCA del total cobrado con descuento. Así, cuando la barbería asume el descuento,
    // la comisión del barbero no varía (ej. servicio 50 Bs con desc. 10 Bs -> al 50% = 25 Bs).
    const baseMonto = precioCatalogo > 0 ? precioCatalogo : (Number(precio_servicio) || 0)

    // 1. Buscar horario del barbero para este día
    const { data: horarioDia } = await supabase
      .from('comision_barbero_horario')
      .select('categoria_id, tiene_herramientas, categoria:comision_categorias(id, nombre, requiere_herramientas)')
      .eq('barbero_id', barbero_id)
      .eq('dia_semana', diaSemana)
      .maybeSingle()

    if (horarioDia && horarioDia.categoria_id) {
      const cat = horarioDia.categoria as any
      resultado.categoria_nombre = cat?.nombre || null
      resultado.tiene_herramientas = cat?.requiere_herramientas
        ? true // Si la categoría requiere herramientas, siempre es true
        : (horarioDia.tiene_herramientas ?? false)

      // 2. Buscar comisión personalizada para este servicio + categoría
      const { data: comisionPersonal } = await supabase
        .from('comision_barbero_servicios')
        .select('*')
        .eq('barbero_id', barbero_id)
        .eq('servicio_id', servicio_id)
        .eq('categoria_id', horarioDia.categoria_id)
        .maybeSingle()

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
          resultado.monto = (baseMonto * (valor || 0)) / 100
        }
        // 'ninguna' → monto = 0

        return resultado
      }
    }

    // 3. Fallback: usar comisión global del servicio o jornada de horas
    if (servConfig && servConfig.comision_activa !== false && servConfig.comision_tipo !== 'ninguna') {
      // 3.1. Servicios con monto fijo específico (Corte de niño Bs 20, Baño de luna Bs 20)
      const esFijoEspecial = servConfig.comision_tipo === 'fija' || /ni[ñn]o/i.test(servNombre) || /ba[ñn]o.*luna/i.test(servNombre)
      if (esFijoEspecial) {
        resultado.tipo_usado = 'global'
        resultado.comision_tipo = 'fija'
        resultado.comision_valor = servConfig.comision_valor || 20
        resultado.monto = resultado.comision_valor
        return resultado
      }

      // 3.2. Servicios con porcentaje específico protegido (Tintes 35%, Diseño 50%)
      const esTinte = /tinte/i.test(servNombre) || (servConfig.comision_valor === 35 && servConfig.comision_tipo === 'porcentaje')
      const esDiseno = /dise[ñn]o/i.test(servNombre) || (servConfig.comision_valor === 50 && /dise/i.test(servNombre))

      if (esTinte || esDiseno) {
        resultado.tipo_usado = 'global'
        resultado.comision_tipo = 'porcentaje'
        resultado.comision_valor = esTinte ? (servConfig.comision_valor || 35) : (servConfig.comision_valor || 50)
        resultado.monto = baseMonto > 0 ? (baseMonto * resultado.comision_valor) / 100 : 0
        return resultado
      }

      // 3.3. Servicios generales (Corte de cabello, combos, barba, etc.):
      // Prioridad A: Porcentaje asignado al barbero en su perfil (modificable por el admin con [40%] [45%] [50%] [✏️])
      let pctFinal: number | null = null
      if (barbero_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('comision_porcentaje')
          .eq('id', barbero_id)
          .maybeSingle()

        if (prof && prof.comision_porcentaje && Number(prof.comision_porcentaje) > 0) {
          pctFinal = Number(prof.comision_porcentaje)
          resultado.tipo_usado = 'perfil'
        }
      }

      // Prioridad B: Si el perfil no tiene porcentaje, calcular según horas de turno (8h -> 40%, 10h -> 45%, 11h -> 50%)
      if (pctFinal === null && barbero_id) {
        const pctHoras = await obtenerPorcentajePorHoras(supabase, barbero_id, diaSemana)
        if (pctHoras !== null) {
          pctFinal = pctHoras
          resultado.tipo_usado = 'horario'
        }
      }

      // Prioridad C: Fallback base (45%)
      if (pctFinal === null) {
        pctFinal = servConfig.comision_valor || 45
        resultado.tipo_usado = 'global'
      }

      resultado.comision_tipo = 'porcentaje'
      resultado.comision_valor = pctFinal
      resultado.monto = baseMonto > 0 ? (baseMonto * pctFinal) / 100 : 0
      return resultado
    }

    // 4. Fallback si no había servConfig
    if (resultado.tipo_usado === 'ninguna' && barbero_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('comision_porcentaje')
        .eq('id', barbero_id)
        .maybeSingle()

      let pctFinal = (prof && prof.comision_porcentaje && Number(prof.comision_porcentaje) > 0)
        ? Number(prof.comision_porcentaje)
        : null

      if (pctFinal === null) {
        pctFinal = await obtenerPorcentajePorHoras(supabase, barbero_id, diaSemana)
      }

      const p = pctFinal || 45
      resultado.tipo_usado = 'perfil'
      resultado.comision_tipo = 'porcentaje'
      resultado.comision_valor = p
      resultado.monto = baseMonto > 0 ? (baseMonto * p) / 100 : 0
    }

    return resultado
  } catch (err) {
    console.error('[calcularComisionBarbero] Error:', err)
    return resultado
  }
}
