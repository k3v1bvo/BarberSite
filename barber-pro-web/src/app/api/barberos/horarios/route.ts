import { createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerAdminClient()
    const [horariosRes, configRes, barberosRes] = await Promise.all([
      supabase
        .from('barbero_horario_semanal')
        .select('*')
        .order('dia_semana', { ascending: true }),
      supabase
        .from('configuraciones')
        .select('llave, valor')
        .like('llave', 'horario_fraccionado_%'),
      supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, phone, role')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name', { ascending: true })
    ])

    const data = horariosRes.data || []
    const configMap = new Map<string, any[]>()
    if (configRes.data) {
      configRes.data.forEach(cfg => {
        const bId = cfg.llave.replace('horario_fraccionado_', '')
        if (cfg.valor?.horario) {
          configMap.set(bId, cfg.valor.horario)
        }
      })
    }

    const dbMap = new Map<string, any>()
    data.forEach(row => {
      dbMap.set(`${row.barbero_id}_${row.dia_semana}`, row)
    })

    const barberList = barberosRes.data || []
    const barberIds = new Set<string>([
      ...barberList.map(b => b.id),
      ...data.map(h => h.barbero_id),
      ...Array.from(configMap.keys())
    ])

    const merged: any[] = []

    for (const bId of barberIds) {
      const cfgList = configMap.get(bId)
      for (let dia = 0; dia <= 6; dia++) {
        const dbRow = dbMap.get(`${bId}_${dia}`)
        const cfgDay = cfgList?.find((c: any) => Number(c.dia_semana) === dia)

        const activo = cfgDay?.activo !== undefined 
          ? Boolean(cfgDay.activo) 
          : (dbRow?.activo !== undefined ? Boolean(dbRow.activo) : dia !== 0)

        const hora_inicio = (cfgDay?.hora_inicio || dbRow?.hora_inicio || '09:00').slice(0, 5)
        const hora_fin = (cfgDay?.hora_fin || dbRow?.hora_fin || '20:00').slice(0, 5)
        const fraccionado = Boolean((dbRow?.hora_inicio_2 && dbRow?.hora_fin_2) || (cfgDay?.fraccionado && cfgDay?.hora_inicio_2))
        const hora_inicio_2 = (cfgDay?.hora_inicio_2 || dbRow?.hora_inicio_2 || '16:00').slice(0, 5)
        const hora_fin_2 = (cfgDay?.hora_fin_2 || dbRow?.hora_fin_2 || '20:30').slice(0, 5)

        merged.push({
          barbero_id: bId,
          dia_semana: dia,
          hora_inicio,
          hora_fin,
          activo,
          fraccionado,
          hora_inicio_2: fraccionado ? hora_inicio_2 : null,
          hora_fin_2: fraccionado ? hora_fin_2 : null,
        })
      }
    }

    return NextResponse.json({
      horarios: merged,
      barberos: barberList
    })
  } catch (err: any) {
    console.error('[GET /api/barberos/horarios] Excepción:', err?.message)
    return NextResponse.json({ horarios: [], barberos: [] })
  }
}
