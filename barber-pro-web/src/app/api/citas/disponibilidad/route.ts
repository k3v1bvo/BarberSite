import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barbero_id = searchParams.get('barbero_id')
  const fecha = searchParams.get('fecha') // Espera formato YYYY-MM-DD

  if (!barbero_id || !fecha) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const adminSupabase = await createServerAdminClient()

  // Definir el rango del día
  const inicioDia = `${fecha}T00:00:00-04:00`
  const finDia = `${fecha}T23:59:59-04:00`

  // 1. Obtener día de la semana (0=Domingo..6=Sábado en hora de Bolivia)
  const dBolivia = new Date(`${fecha}T12:00:00-04:00`)
  const diaSemana = dBolivia.getDay()

  // 2. Consultar horario semanal, tiempo mínimo de reserva, bloqueos, citas, feriados, permisos y asistencia con adminSupabase
  const [horarioRes, configRes, bloqueosRes, citasRes, feriadosRes, permisosRes, asistenciaRes, configFraccionadoRes] = await Promise.all([
    adminSupabase
      .from('barbero_horario_semanal')
      .select('*')
      .eq('barbero_id', barbero_id)
      .eq('dia_semana', diaSemana)
      .maybeSingle(),
    adminSupabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'tiempo_minimo_reserva')
      .maybeSingle(),
    adminSupabase
      .from('barbero_bloqueos')
      .select('fecha_inicio, fecha_fin, tipo, todo_el_dia')
      .eq('barbero_id', barbero_id)
      .gte('fecha_fin', inicioDia)
      .lte('fecha_inicio', finDia),
    adminSupabase
      .from('citas')
      .select('fecha_hora, duracion_real_minutos, servicios(duracion_minutos)')
      .eq('barbero_id', barbero_id)
      .gte('fecha_hora', inicioDia)
      .lte('fecha_hora', finDia)
      .not('estado', 'in', '("cancelado","no_presento","comprobante_rechazado")'),
    adminSupabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'feriados_config')
      .maybeSingle(),
    adminSupabase
      .from('solicitudes_permisos')
      .select('fecha, fecha_fin, hora_inicio, hora_fin, tipo_permiso, estado, motivo')
      .eq('barbero_id', barbero_id)
      .eq('estado', 'aprobado')
      .lte('fecha', fecha),
    adminSupabase
      .from('asistencias')
      .select('id, hora_entrada, hora_salida, estado, notas')
      .eq('profile_id', barbero_id)
      .eq('fecha', fecha)
      .maybeSingle(),
    adminSupabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', `horario_fraccionado_${barbero_id}`)
      .maybeSingle()
  ])

  const horario = horarioRes.data
  const rawTiempoMin = configRes.data?.valor
  let tiempoMinimoReserva = 60
  if (rawTiempoMin) {
    if (typeof rawTiempoMin === 'object' && (rawTiempoMin as any).minutos !== undefined) {
      tiempoMinimoReserva = Number((rawTiempoMin as any).minutos)
    } else if (typeof rawTiempoMin === 'number') {
      tiempoMinimoReserva = rawTiempoMin
    } else if (typeof rawTiempoMin === 'string') {
      tiempoMinimoReserva = Number(rawTiempoMin) || 60
    }
  }

  // Feriados
  const feriadosList: Array<{ fecha: string; nombre: string; tipo: 'cerrado' | 'con_atencion'; hora_inicio?: string; hora_fin?: string }> =
    (feriadosRes.data?.valor as any)?.feriados || []

  const feriadoCoincidente = feriadosList.find(f => f.fecha === fecha)

  const esManual = searchParams.get('manual') === 'true' || searchParams.get('es_manual') === 'true'

  let disponible = true
  let hora_inicio = '09:00'
  let hora_fin = '20:00'
  let motivo = ''
  let esFraccionado = false
  let turnos: Array<{ inicio: string; fin: string }> = []
  let t1_fin_str = ''
  let t2_ini_str = ''

  // Prioridad 1: Evaluación de Feriados
  if (feriadoCoincidente) {
    if (feriadoCoincidente.tipo === 'cerrado') {
      if (esManual) {
        disponible = true
        motivo = `Feriado: ${feriadoCoincidente.nombre} (Agendamiento manual)`
        hora_inicio = '09:00'
        hora_fin = '20:00'
        turnos = [{ inicio: hora_inicio, fin: hora_fin }]
      } else {
        disponible = false
        motivo = `Feriado: ${feriadoCoincidente.nombre} (Cerrado sin atención al público)`
      }
    } else {
      disponible = true
      hora_inicio = feriadoCoincidente.hora_inicio || '10:00'
      hora_fin = feriadoCoincidente.hora_fin || '16:00'
      motivo = `Feriado Especial: ${feriadoCoincidente.nombre}`
      turnos = [{ inicio: hora_inicio, fin: hora_fin }]
    }
  } 
  // Prioridad 2: Horario Semanal Estándar o Fraccionado (Unificando barbero_horario_semanal y configuraciones)
  else {
    const cfgHorario = configFraccionadoRes.data?.valor?.horario as any[] | undefined
    const cfgDay = cfgHorario?.find((c: any) => Number(c.dia_semana) === diaSemana)

    const hasConfig = Boolean(horario || cfgDay)
    const isActivo = cfgDay?.activo !== undefined 
      ? Boolean(cfgDay.activo) 
      : (horario?.activo !== undefined ? Boolean(horario.activo) : diaSemana !== 0)

    if (hasConfig && !isActivo) {
      if (esManual) {
        disponible = true
        hora_inicio = (cfgDay?.hora_inicio || horario?.hora_inicio || '09:00').slice(0, 5)
        hora_fin = (cfgDay?.hora_fin || horario?.hora_fin || '20:00').slice(0, 5)
        turnos = [{ inicio: hora_inicio, fin: hora_fin }]
        motivo = 'Día libre habitual del barbero (se permite agendamiento manual)'
      } else {
        disponible = false
        motivo = diaSemana === 0 ? 'El barbero no atiende los domingos.' : 'El barbero no atiende en este día de la semana.'
      }
    } else if (hasConfig && isActivo) {
      const hasDbT2 = Boolean(horario?.hora_inicio_2 && horario?.hora_fin_2)
      const hasCfgT2 = Boolean(cfgDay?.fraccionado && cfgDay?.hora_inicio_2 && cfgDay?.hora_fin_2)

      if (hasDbT2 || hasCfgT2) {
        esFraccionado = true
        const t1_ini = (cfgDay?.hora_inicio || horario?.hora_inicio || '09:00').slice(0, 5)
        const t1_fin = (cfgDay?.hora_fin || horario?.hora_fin || '13:00').slice(0, 5)
        const t2_ini = (cfgDay?.hora_inicio_2 || horario?.hora_inicio_2 || '16:00').slice(0, 5)
        const t2_fin = (cfgDay?.hora_fin_2 || horario?.hora_fin_2 || '20:30').slice(0, 5)

        hora_inicio = t1_ini
        hora_fin = t2_fin
        t1_fin_str = t1_fin
        t2_ini_str = t2_ini

        turnos = [
          { inicio: t1_ini, fin: t1_fin },
          { inicio: t2_ini, fin: t2_fin }
        ]
      } else {
        hora_inicio = (cfgDay?.hora_inicio || horario?.hora_inicio || '09:00').slice(0, 5)
        hora_fin = (cfgDay?.hora_fin || horario?.hora_fin || '20:00').slice(0, 5)
        turnos = [{ inicio: hora_inicio, fin: hora_fin }]
      }
    } else {
      // Sin configuración para este día: Domingo cerrado por defecto, resto 09:00 a 20:00
      if (diaSemana === 0 && !esManual) {
        disponible = false
        motivo = 'El barbero no atiende los domingos.'
      } else {
        hora_inicio = '09:00'
        hora_fin = '20:00'
        turnos = [{ inicio: hora_inicio, fin: hora_fin }]
        disponible = true
      }
    }
  }

  // Extraer las horas ocupadas con su duración (citas, bloqueos parciales, recesos fraccionados y permisos por horas)
  const ocupados: Array<{ hora: string; duracion: number }> = []

  // Si tiene horario fraccionado, bloquear el intervalo intermedio entre turno 1 y turno 2
  if (esFraccionado && t1_fin_str && t2_ini_str) {
    const [h1, m1] = t1_fin_str.split(':').map(Number)
    const [h2, m2] = t2_ini_str.split(':').map(Number)
    const gapMinutos = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (gapMinutos > 0) {
      ocupados.push({
        hora: t1_fin_str,
        duracion: gapMinutos
      })
    }
  }

  // Prioridad 4: Evaluación de Permisos Aprobados (solicitudes_permisos)
  let permisosList = permisosRes.data || []
  if (!permisosList.length) {
    // Fallback configuraciones si aplica
    try {
      const { data: cfgPerm } = await adminSupabase.from('configuraciones').select('valor').eq('llave', 'solicitudes_permisos_data').maybeSingle()
      if (cfgPerm?.valor) {
        const rawList = typeof cfgPerm.valor === 'string' ? JSON.parse(cfgPerm.valor) : cfgPerm.valor
        permisosList = Array.isArray(rawList) ? rawList.filter((p: any) => p.barbero_id === barbero_id && p.estado === 'aprobado') : []
      }
    } catch (_) {}
  }

  const permisoAprobado = permisosList.find((p: any) => {
    const fInicio = p.fecha
    const fFin = p.fecha_fin || p.fecha
    return fInicio <= fecha && fFin >= fecha
  })

  if (permisoAprobado && disponible) {
    if (permisoAprobado.tipo_permiso === 'horas' && permisoAprobado.hora_inicio && permisoAprobado.hora_fin) {
      const [h1, m1] = permisoAprobado.hora_inicio.slice(0, 5).split(':').map(Number)
      const [h2, m2] = permisoAprobado.hora_fin.slice(0, 5).split(':').map(Number)
      const durMin = Math.max(15, (h2 * 60 + m2) - (h1 * 60 + m1))
      ocupados.push({
        hora: permisoAprobado.hora_inicio.slice(0, 5),
        duracion: durMin
      })
    } else {
      if (esManual) {
        motivo = `El barbero tiene permiso aprobado (${permisoAprobado.motivo || 'Permiso Justificado'}), pero se permite agendar manualmente.`
      } else {
        disponible = false
        motivo = `El barbero cuenta con un permiso aprobado en esta fecha (${permisoAprobado.motivo || 'Permiso Justificado'}).`
      }
    }
  }

  // Prioridad 5: Evaluación de Asistencia en Tiempo Real si es HOY (Solo para reservas públicas web)
  const nowBolivia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
  const hoyBolivia = `${nowBolivia.getFullYear()}-${String(nowBolivia.getMonth() + 1).padStart(2, '0')}-${String(nowBolivia.getDate()).padStart(2, '0')}`
  const esHoy = fecha === hoyBolivia
  const currentMinutes = nowBolivia.getHours() * 60 + nowBolivia.getMinutes()
  const [hIni] = hora_inicio.split(':').map(Number)
  const startMinutes = (hIni || 9) * 60

  if (esHoy && disponible && !esManual) {
    const asis = asistenciaRes.data
    if (asis) {
      if (asis.estado === 'permiso') {
        disponible = false
        motivo = 'El barbero cuenta con permiso aprobado el día de hoy.'
      } else if (asis.estado === 'falta') {
        disponible = false
        motivo = 'El barbero no asistió el día de hoy (falta registrada).'
      } else if (asis.hora_salida) {
        // En horario fraccionado, la hora_salida puede ser el fin de Turno 1
        if (esFraccionado && t2_ini_str) {
          const [h2, m2] = t2_ini_str.split(':').map(Number)
          const startT2Minutes = h2 * 60 + m2
          if (currentMinutes < (startT2Minutes + 30)) {
            // Está en receso intermedio esperando el segundo turno de la tarde
            // Las reservas siguen activas para el segundo turno!
          } else {
            disponible = false
            motivo = 'El barbero finalizó el turno matutino y aún no ha marcado ingreso para el turno tarde.'
          }
        } else {
          disponible = false
          motivo = 'El barbero ya finalizó su jornada laboral de hoy.'
        }
      } else if (!asis.hora_entrada && currentMinutes >= (startMinutes + 30)) {
        disponible = false
        motivo = 'El barbero no se encuentra presente en el local el día de hoy (sin asistencia registrada).'
      }
    } else {
      // Si no existe registro de asistencia y ya pasaron 30 min del inicio de la jornada
      if (esFraccionado && t2_ini_str) {
        const [h2, m2] = t2_ini_str.split(':').map(Number)
        const startT2Minutes = h2 * 60 + m2
        if (currentMinutes >= (startMinutes + 30) && currentMinutes < startT2Minutes) {
          // No vino al turno 1, pero aún no inicia el turno 2
        } else if (currentMinutes >= (startT2Minutes + 30)) {
          disponible = false
          motivo = 'El barbero no se encuentra presente en el local el día de hoy (sin marcación de entrada).'
        }
      } else if (currentMinutes >= (startMinutes + 30)) {
        disponible = false
        motivo = 'El barbero no se encuentra presente en el local el día de hoy (sin marcación de entrada).'
      }
    }
  }

  // Verificar bloqueos de todo el día o día libre/vacación completa
  const bloqueos = bloqueosRes.data || []
  const bloqueoTodoDia = bloqueos.find(b => b.todo_el_dia || b.tipo === 'vacacion' || b.tipo === 'dia_libre')
  if (bloqueoTodoDia && disponible && !esManual) {
    disponible = false
    motivo = bloqueoTodoDia.tipo === 'vacacion' ? 'El barbero está de vacaciones en esta fecha.' : 'Día libre o bloqueo programado para el barbero.'
  }

  if (citasRes.data) {
    citasRes.data.forEach(cita => {
      const d = new Date(cita.fecha_hora)
      const hora = d.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false,
        timeZone: 'America/La_Paz'
      })
      ocupados.push({
        hora,
        duracion: cita.duracion_real_minutos || (cita.servicios as any)?.duracion_minutos || 30
      })
    })
  }

  bloqueos.forEach(b => {
    if (b.todo_el_dia || b.tipo === 'vacacion' || b.tipo === 'dia_libre') return
    const dInicio = new Date(b.fecha_inicio)
    const dFin = new Date(b.fecha_fin)
    
    const inicioReal = dInicio.getTime() < new Date(inicioDia).getTime() ? new Date(inicioDia) : dInicio
    
    const hora = inicioReal.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: 'America/La_Paz'
    })
    
    const duracionMs = dFin.getTime() - inicioReal.getTime()
    const duracionMinutos = Math.max(15, Math.floor(duracionMs / 60000))
    
    ocupados.push({
      hora,
      duracion: duracionMinutos
    })
  })

  return NextResponse.json({ 
    ocupados,
    disponible,
    hora_inicio,
    hora_fin,
    turnos,
    fraccionado: esFraccionado,
    motivo,
    tiempo_minimo_reserva: tiempoMinimoReserva
  })
}
