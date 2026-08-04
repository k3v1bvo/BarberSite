import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()

  const { barbero_id, plantilla_id, dias } = body

  if (!barbero_id || !plantilla_id || !dias || !Array.isArray(dias)) {
    return NextResponse.json({ error: 'Faltan datos requeridos o formato inválido' }, { status: 400 })
  }

  // First, get the template details
  const { data: plantilla, error: plantillaError } = await supabase
    .from('plantillas_horario')
    .select('*')
    .eq('id', plantilla_id)
    .single()

  if (plantillaError || !plantilla) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
  }

  // Then, delete existing schedule for these days for this barber
  // If the user wants to replace the days, we delete and insert.
  const { error: deleteError } = await supabase
    .from('barbero_horario_semanal')
    .delete()
    .eq('barbero_id', barbero_id)
    .in('dia_semana', dias)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Prepare new schedules
  const newSchedules = dias.map((dia: number) => ({
    barbero_id,
    plantilla_id,
    dia_semana: dia,
    hora_inicio: plantilla.hora_inicio,
    hora_fin: plantilla.hora_fin,
    activo: true,
    tipo_horario: plantilla.tipo,
  }))

  if (newSchedules.length > 0) {
    const { error: insertError } = await supabase
      .from('barbero_horario_semanal')
      .insert(newSchedules)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
