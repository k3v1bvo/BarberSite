import { createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerAdminClient()
    const [horariosRes, configRes] = await Promise.all([
      supabase
        .from('barbero_horario_semanal')
        .select('*')
        .order('dia_semana', { ascending: true }),
      supabase
        .from('configuraciones')
        .select('llave, valor')
        .like('llave', 'horario_fraccionado_%')
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

    const merged = data.map(h => {
      const cfgList = configMap.get(h.barbero_id)
      const cfgDay = cfgList?.find((c: any) => Number(c.dia_semana) === Number(h.dia_semana))
      const fraccionado = Boolean((h.hora_inicio_2 && h.hora_fin_2) || (cfgDay?.fraccionado && cfgDay?.hora_inicio_2))
      return {
        barbero_id: h.barbero_id,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
        fraccionado,
        hora_inicio_2: h.hora_inicio_2 || cfgDay?.hora_inicio_2 || null,
        hora_fin_2: h.hora_fin_2 || cfgDay?.hora_fin_2 || null,
      }
    })

    return NextResponse.json({ horarios: merged })
  } catch (err: any) {
    console.error('[GET /api/barberos/horarios] Excepción:', err?.message)
    return NextResponse.json({ horarios: [] })
  }
}
