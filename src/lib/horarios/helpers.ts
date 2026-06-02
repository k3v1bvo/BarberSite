import type { SupabaseClient } from '@supabase/supabase-js'

export interface HorarioDia {
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

const DEFAULT_HORARIO: HorarioDia = {
  hora_inicio: '09:00',
  hora_fin: '20:00',
  activo: true,
}

export async function getHorarioBarberoDia(
  supabase: SupabaseClient,
  barberoId: string,
  fecha: string
): Promise<HorarioDia> {
  const dia = new Date(`${fecha}T12:00:00`).getDay()

  const { data, error } = await supabase
    .from('barbero_horario_semanal')
    .select('hora_inicio, hora_fin, activo')
    .eq('barbero_id', barberoId)
    .eq('dia_semana', dia)
    .maybeSingle()

  if (error?.code === '42P01' || !data || !data.activo) {
    return { ...DEFAULT_HORARIO, activo: data?.activo !== false }
  }

  return {
    hora_inicio: data.hora_inicio?.slice(0, 5) || '09:00',
    hora_fin: data.hora_fin?.slice(0, 5) || '20:00',
    activo: data.activo,
  }
}

export async function isDiaBloqueado(
  supabase: SupabaseClient,
  barberoId: string,
  fecha: string
): Promise<boolean> {
  const inicio = `${fecha}T00:00:00`
  const fin = `${fecha}T23:59:59`

  const { data, error } = await supabase
    .from('barbero_bloqueos')
    .select('id')
    .eq('barbero_id', barberoId)
    .lte('fecha_inicio', fin)
    .gte('fecha_fin', inicio)
    .limit(1)

  if (error?.code === '42P01') return false
  return (data?.length ?? 0) > 0
}

export function generarSlotsHorario(horaInicio: string, horaFin: string, intervaloMin = 30): string[] {
  const slots: string[] = []
  const [hI, mI] = horaInicio.split(':').map(Number)
  const [hF, mF] = horaFin.split(':').map(Number)
  let current = hI * 60 + mI
  const end = hF * 60 + mF

  while (current < end) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += intervaloMin
  }
  return slots
}

export function calcularHorasExtras(
  horaSalida: string,
  horaFinProgramada: string | null
): number {
  if (!horaFinProgramada) return 0
  const salida = new Date(horaSalida)
  const salidaMin = salida.getHours() * 60 + salida.getMinutes()
  const [hF, mF] = horaFinProgramada.split(':').map(Number)
  const finMin = hF * 60 + mF
  if (salidaMin <= finMin) return 0
  return Number(((salidaMin - finMin) / 60).toFixed(2))
}
