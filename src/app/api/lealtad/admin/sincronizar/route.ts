import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'

export async function GET(req: Request) {
  try {
    const supabase = createAdminSupabaseClient()
    if (!supabase) return NextResponse.json({ error: 'No admin client' })

    // 1. Obtener todas las metas activas
    const { data: metas } = await supabase
      .from('lealtad_metas')
      .select('nombre, visitas_requeridas')
      .eq('is_active', true)
      .order('visitas_requeridas', { ascending: false })

    if (!metas || metas.length === 0) {
      return NextResponse.json({ message: 'No hay metas de lealtad activas' })
    }

    // 2. Obtener todos los clientes
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nombre, total_visitas, nivel_fidelidad')

    if (!clientes) return NextResponse.json({ message: 'No hay clientes' })

    let actualizados = 0
    const logs = []

    // 3. Sincronizar niveles
    for (const c of clientes) {
      const visitas = c.total_visitas || 0
      
      const metaAlcanzada = metas.find(m => visitas >= m.visitas_requeridas)
      const nivelCorrecto = metaAlcanzada ? metaAlcanzada.nombre.toUpperCase() : 'BRONCE'

      if (c.nivel_fidelidad !== nivelCorrecto) {
        logs.push(`[${c.nombre}] Visitas: ${visitas}. Nivel: ${c.nivel_fidelidad} -> ${nivelCorrecto}`)
        
        await supabase
          .from('clientes')
          .update({ nivel_fidelidad: nivelCorrecto })
          .eq('id', c.id)

        actualizados++
      }
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: `Sincronizados ${actualizados} clientes`,
      metas_usadas: metas,
      logs 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
