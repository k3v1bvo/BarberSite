import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-guards'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { barbero_id, plantilla_id, dias } = await request.json()

  const { data: plantilla, error: pError } = await supabase
    .from('plantillas_horario')
    .select('*')
    .eq('id', plantilla_id)
    .single()

  if (pError || !plantilla) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
  }

  const diasAplicar: number[] = dias?.length ? dias : [1, 2, 3, 4, 5, 6]

  // Optimización: Batch upsert en lugar de loop
  const records = diasAplicar.map(dia => ({
    barbero_id,
    dia_semana: dia,
    hora_inicio: plantilla.hora_inicio?.slice(0, 5) || '09:00',
    hora_fin: plantilla.hora_fin?.slice(0, 5) || '20:00',
    activo: true,
    tipo_horario: plantilla.tipo,
    plantilla_id: plantilla.id,
  }))

  const { error } = await supabase
    .from('barbero_horario_semanal')
    .upsert(records, { onConflict: 'barbero_id,dia_semana' })

  if (error) {
     return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dias: diasAplicar.length })
}
