import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barbero_id = searchParams.get('barbero_id')
  const fecha = searchParams.get('fecha') // Espera formato YYYY-MM-DD

  if (!barbero_id || !fecha) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // Definir el rango del día
  const inicioDia = `${fecha}T00:00:00-04:00`
  const finDia = `${fecha}T23:59:59-04:00`

  // 1. Obtener día de la semana (0=Domingo..6=Sábado en hora de Bolivia)
  const dBolivia = new Date(`${fecha}T12:00:00-04:00`)
  const diaSemana = dBolivia.getDay()

  // 2. Consultar horario semanal y tiempo mínimo de reserva en paralelo
  const [horarioRes, configRes, bloqueosRes, citasRes] = await Promise.all([
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
      .not('estado', 'eq', 'cancelada')
  ])

  const horario = horarioRes.data
  const tiempoMinimoReserva = (configRes.data?.valor as any)?.minutos || 180

  // Verificar si el barbero trabaja este día según horario semanal
  let disponible = true
  let hora_inicio = '09:00'
  let hora_fin = '20:00'
  let motivo = ''

  if (horario) {
    if (!horario.activo) {
      disponible = false
      motivo = 'El barbero no atiende en este día de la semana.'
    } else {
      hora_inicio = horario.hora_inicio ? horario.hora_inicio.slice(0, 5) : '09:00'
      hora_fin = horario.hora_fin ? horario.hora_fin.slice(0, 5) : '20:00'
    }
  } else if (diaSemana === 0) {
    // Por defecto si no hay horario configurado, domingo no laborable
    disponible = false
    motivo = 'El barbero no atiende los domingos.'
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
    tiempo_minimo_reserva
  })
}

