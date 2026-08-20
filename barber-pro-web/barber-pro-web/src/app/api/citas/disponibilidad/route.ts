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

  // 2. Consultar horario semanal, tiempo mínimo de reserva, bloqueos, citas, feriados y domingos rotativos
  const [horarioRes, configRes, bloqueosRes, citasRes, feriadosRes, domingosRes] = await Promise.all([
    supabase
      .from('barbero_horario_semanal')
      .select('hora_inicio, hora_fin, activo')
      .eq('barbero_id', barbero_id)
      .eq('dia_semana', diaSemana)
      .maybeSingle(),
    supabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'tiempo_minimo_reserva')
      .maybeSingle(),
    supabase
      .from('barbero_bloqueos')
      .select('fecha_inicio, fecha_fin, tipo, todo_el_dia')
      .eq('barbero_id', barbero_id)
      .gte('fecha_fin', inicioDia)
      .lte('fecha_inicio', finDia),
    supabase
      .from('citas')
      .select('fecha_hora, duracion_real_minutos')
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
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'domingos_rotativos_config')
      .maybeSingle(),
  ])

  const horario = horarioRes.data
  const tiempoMinimoReserva = (configRes.data?.valor as any)?.minutos || 180

  // Feriados & Domingos Rotativos
  const feriadosList: Array<{ fecha: string; nombre: string; tipo: 'cerrado' | 'con_atencion'; hora_inicio?: string; hora_fin?: string }> =
    (feriadosRes.data?.valor as any)?.feriados || []

  const domingosList: Array<{ fecha: string; barberos_habilitados: string[] }> =
    (domingosRes.data?.valor as any)?.domingos || []

  const feriadoCoincidente = feriadosList.find(f => f.fecha === fecha)
  const domingoCoincidente = domingosList.find(d => d.fecha === fecha)

  let disponible = true
  let hora_inicio = '09:00'
  let hora_fin = '20:00'
  let motivo = ''

  // Prioridad 1: Evaluación de Feriados
  if (feriadoCoincidente) {
    if (feriadoCoincidente.tipo === 'cerrado') {
      disponible = false
      motivo = `Feriado: ${feriadoCoincidente.nombre} (Cerrado sin atención al público)`
    } else {
      disponible = true
      hora_inicio = feriadoCoincidente.hora_inicio || '10:00'
      hora_fin = feriadoCoincidente.hora_fin || '16:00'
      motivo = `Feriado Especial: ${feriadoCoincidente.nombre}`
    }
  } 
  // Prioridad 2: Evaluación de Domingos Rotativos
  else if (diaSemana === 0) {
    if (domingoCoincidente) {
      const estaHabilitado = domingoCoincidente.barberos_habilitados?.includes(barbero_id)
      if (estaHabilitado) {
        disponible = true
        // Usar horario de domingo si está configurado en semanal, sino 09:00 a 16:00
        hora_inicio = horario?.hora_inicio ? horario.hora_inicio.slice(0, 5) : '09:00'
        hora_fin = horario?.hora_fin ? horario.hora_fin.slice(0, 5) : '16:00'
      } else {
        disponible = false
        motivo = 'El barbero no atiende este domingo.'
      }
    } else {
      // Si no está registrado en el lote de domingos rotativos, revisar horario semanal individual
      if (horario && horario.activo) {
        disponible = true
        hora_inicio = horario.hora_inicio ? horario.hora_inicio.slice(0, 5) : '09:00'
        hora_fin = horario.hora_fin ? horario.hora_fin.slice(0, 5) : '16:00'
      } else {
        disponible = false
        motivo = 'El barbero no atiende los domingos.'
      }
    }
  } 
  // Prioridad 3: Horario Semanal Estándar
  else if (horario) {
    if (!horario.activo) {
      disponible = false
      motivo = 'El barbero no atiende en este día de la semana.'
    } else {
      hora_inicio = horario.hora_inicio ? horario.hora_inicio.slice(0, 5) : '09:00'
      hora_fin = horario.hora_fin ? horario.hora_fin.slice(0, 5) : '20:00'
    }
  }

  // Verificar bloqueos de todo el día o día libre/vacación completa
  const bloqueos = bloqueosRes.data || []
  const bloqueoTodoDia = bloqueos.find(b => b.todo_el_dia || b.tipo === 'vacacion' || b.tipo === 'dia_libre')
  if (bloqueoTodoDia && disponible) {
    disponible = false
    motivo = bloqueoTodoDia.tipo === 'vacacion' ? 'El barbero está de vacaciones en esta fecha.' : 'Día libre o bloqueo programado para el barbero.'
  }

  // Extraer las horas ocupadas con su duración (citas y bloqueos parciales como almuerzo)
  const ocupados: Array<{ hora: string; duracion: number }> = []

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
        duracion: cita.duracion_real_minutos || 30
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
    motivo,
    tiempo_minimo_reserva: tiempoMinimoReserva
  })
}
