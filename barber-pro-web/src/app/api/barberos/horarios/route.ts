import { createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerAdminClient()
    const { data, error } = await supabase
      .from('barbero_horario_semanal')
      .select('barbero_id, dia_semana, hora_inicio, hora_fin, activo')
      .order('dia_semana', { ascending: true })

    if (error) {
      console.error('[GET /api/barberos/horarios] Error:', error.message)
      return NextResponse.json({ horarios: [] })
    }

    return NextResponse.json({ horarios: data || [] })
  } catch (err: any) {
    console.error('[GET /api/barberos/horarios] Excepción:', err?.message)
    return NextResponse.json({ horarios: [] })
  }
}
