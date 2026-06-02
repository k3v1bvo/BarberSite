import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getHorarioBarberoDia, isDiaBloqueado, generarSlotsHorario } from '@/lib/horarios/helpers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barbero_id = searchParams.get('barbero_id')
  const fecha = searchParams.get('fecha')

  if (!barbero_id || !fecha) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const bloqueado = await isDiaBloqueado(supabase, barbero_id, fecha)
  if (bloqueado) {
    return NextResponse.json({ ocupados: [], dia_bloqueado: true, slots: [] })
  }

  const horario = await getHorarioBarberoDia(supabase, barbero_id, fecha)
  if (!horario.activo) {
    return NextResponse.json({ ocupados: [], dia_inactivo: true, slots: [] })
  }

  const inicioDia = `${fecha}T00:00:00`
  const finDia = `${fecha}T23:59:59`

  const { data: citas, error } = await supabase
    .from('citas')
    .select('fecha_hora, duracion_real_minutos')
    .eq('barbero_id', barbero_id)
    .gte('fecha_hora', inicioDia)
    .lte('fecha_hora', finDia)
    .not('estado', 'eq', 'cancelado')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ocupados = (citas ?? []).map((cita) => {
    const d = new Date(cita.fecha_hora)
    const hora = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return {
      hora,
      duracion: cita.duracion_real_minutos ?? 30,
    }
  })

  const slots = generarSlotsHorario(horario.hora_inicio, horario.hora_fin)

  return NextResponse.json({
    ocupados,
    slots,
    horario: { inicio: horario.hora_inicio, fin: horario.hora_fin },
  })
}
