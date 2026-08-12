import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // 1. Obtener todas las promociones ordenadas por fecha de creación
    const { data: promos, error } = await supabase
      .from('promociones')
      .select('id, nombre, tipo, creada_en')
      .order('creada_en', { ascending: true })

    if (error) throw error

    const vists = new Set<string>()
    const idsAEliminar: string[] = []

    for (const p of promos || []) {
      const key = `${(p.nombre || '').toLowerCase().trim()}_${p.tipo}`
      if (vists.has(key)) {
        idsAEliminar.push(p.id)
      } else {
        vists.add(key)
      }
    }

    if (idsAEliminar.length > 0) {
      const { error: delErr } = await supabase
        .from('promociones')
        .delete()
        .in('id', idsAEliminar)

      if (delErr) throw delErr
    }

    return NextResponse.json({
      success: true,
      eliminadasCount: idsAEliminar.length,
      message: `Se eliminaron ${idsAEliminar.length} promociones duplicadas de la base de datos.`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al limpiar duplicados' }, { status: 500 })
  }
}
