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
  const inicioDia = `${fecha}T00:00:00`
  const finDia = `${fecha}T23:59:59`

  // Consultar citas ya existentes para ese barbero en ese día
  const { data: citas, error } = await supabase
    .from('citas')
    .select('fecha_hora, duracion_real_minutos')
    .eq('barbero_id', barbero_id)
    .gte('fecha_hora', inicioDia)
    .lte('fecha_hora', finDia)
    .not('estado', 'eq', 'cancelada')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Consultar bloqueos u horarios libres anulados
  const { data: bloqueos } = await supabase
    .from('barbero_bloqueos')
    .select('inicio, fin, tipo')
    .eq('barbero_id', barbero_id)
    .gte('fin', inicioDia)
    .lte('inicio', finDia)

  // Extraer las horas ocupadas con su duración
  const ocupados = (citas || []).map(cita => {
    const d = new Date(cita.fecha_hora)
    const hora = d.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    })
    return {
      hora,
      duracion: cita.duracion_real_minutos
    }
  })

  // Añadir bloqueos como horas ocupadas
  if (bloqueos) {
    bloqueos.forEach(b => {
      const dInicio = new Date(b.inicio)
      const dFin = new Date(b.fin)
      
      const inicioReal = dInicio.getTime() < new Date(inicioDia).getTime() ? new Date(inicioDia) : dInicio
      
      const hora = inicioReal.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      })
      
      const duracionMs = dFin.getTime() - inicioReal.getTime()
      const duracionMinutos = Math.floor(duracionMs / 60000)
      
      ocupados.push({
        hora,
        duracion: duracionMinutos
      })
    })
  }

  return NextResponse.json({ ocupados })
}
